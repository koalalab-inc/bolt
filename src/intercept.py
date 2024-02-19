"""
Intercept.py

This script is used to intercept the traffic and log the
requests to a file. It also blocks the requests based on
the rules defined in the egress_rules.yaml file.
"""

import os
import json
import logging
import re
import time
from queue import Queue
from threading import Lock, Thread

import ruamel.yaml
from mitmproxy import ctx
from OpenSSL import SSL

FILE_WORKERS = 5

DEFAULT_EGRESS_RULES_YAML = """
- name: 'Reqd by Github Action'
  description: 'Needed for essential operations'
  destination: 'github.com'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for essential operations'
  destination: 'api.github.com'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for essential operations'
  destination: '*.actions.githubusercontent.com'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for downloading actions'
  destination: 'codeload.github.com'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for uploading/downloading job \
summaries, logs, workflow artifacts, and caches'
  destination: 'results-receiver.actions.githubusercontent.com'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for uploading/downloading job \
summaries, logs, workflow artifacts, and caches'
  destination: '*.blob.core.windows.net'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for runner version updates'
  destination: 'objects.githubusercontent.com'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for runner version updates'
  destination: 'objects-origin.githubusercontent.com'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for runner version updates'
  destination: 'github-releases.githubusercontent.com'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for runner version updates'
  destination: 'github-registry-files.githubusercontent.com'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for retrieving OIDC tokens'
  destination: '*.actions.githubusercontent.com'
  action: 'allow'
- name : 'Reqd by Github Action'
  description: 'Needed for downloading or publishing \
packages or containers to GitHub Packages'
  destination: '*.pkg.github.com'
  action: 'allow'
- name : 'Reqd by Github Action'
  description: 'Needed for downloading or publishing \
packages or containers to GitHub Packages'
  destination: 'ghcr.io'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for Git Large File Storage'
  destination: 'github-cloud.githubusercontent.com'
  action: 'allow'
- name: 'Reqd by Github Action'
  description: 'Needed for Git Large File Storage'
  destination: 'github-cloud.s3.amazonaws.com'
  action: 'allow'
- name: 'Reqd by NPM install'
  description: 'Needed for NPM install'
  destination: 'registry.npmjs.org'
  action: 'allow'
- name: 'Reqd for instance metadata'
  description: 'Needed for instance metadata'
  destination: '169.254.169.254'
  action: 'allow'
"""


# pylint: disable=missing-class-docstring,missing-function-docstring,unspecified-encoding
class Interceptor:
    # pylint: disable=too-many-instance-attributes
    def __init__(self):
        self.outfile = None
        self.encode = None
        self.url = None
        self.lock = None
        self.auth = None
        self.queue = Queue()
        self.egress_rules = None
        self.mode = os.environ.get("BOLT_MODE", "audit")
        self.default_policy = os.environ.get("BOLT_DEFAULT_POLICY", "block-all")
        self.allow_http = os.environ.get("BOLT_ALLOW_HTTP", False)
        with open("/home/bolt/egress_rules.yaml", "r") as file:
            yaml = ruamel.yaml.YAML(typ="safe", pure=True)
            self.egress_rules = yaml.load(file)
            default_egress_rules = yaml.load(DEFAULT_EGRESS_RULES_YAML)
            self.egress_rules = self.egress_rules + default_egress_rules

    def done(self):
        self.queue.join()
        if self.outfile:
            self.outfile.close()

    @classmethod
    def convert_to_strings(cls, obj):
        if isinstance(obj, dict):
            return {
                cls.convert_to_strings(key): cls.convert_to_strings(value)
                for key, value in obj.items()
            }
        if isinstance(obj, (list, tuple)):
            return [cls.convert_to_strings(element) for element in obj]
        if isinstance(obj, bytes):
            return str(obj)[2:-1]
        return obj

    def worker(self):
        while True:
            frame = self.queue.get()
            self.dump(frame)
            self.queue.task_done()

    def dump(self, frame):
        frame["mode"] = self.mode
        frame["timestamp"] = time.strftime("%X %x %Z")
        frame = self.convert_to_strings(frame)

        if self.outfile:
            # pylint: disable=consider-using-with
            self.lock.acquire()
            self.outfile.write(json.dumps(frame) + "\n")
            self.outfile.flush()
            self.lock.release()

    @staticmethod
    def load(loader):
        loader.add_option(
            "dump_destination",
            str,
            "jsondump.out",
            "Output destination: path to a file or URL.",
        )

    def configure(self, _):
        dump_destination = ctx.options.dump_destination
        # pylint: disable=consider-using-with
        self.outfile = open(dump_destination, "a")
        self.lock = Lock()
        logging.info("Writing all data frames to %s", dump_destination)

        for _ in range(FILE_WORKERS):
            t = Thread(target=self.worker)
            t.daemon = True
            t.start()

    def wildcard_to_regex(self, wildcard_destination):
        # Escape special characters
        regex_pattern = re.escape(wildcard_destination)
        # Replace wildcard with regex equivalent
        regex_pattern = regex_pattern.replace(r"\*", ".*")
        # Ensure the pattern matches the entire string
        regex_pattern = "^" + regex_pattern + "$"
        return re.compile(regex_pattern)

    def tls_clienthello(self, data):
        default_policy = self.default_policy

        matched_rules = []

        for rule in self.egress_rules:
            destination_pattern = self.wildcard_to_regex(rule["destination"])
            destination = data.client_hello.sni
            if destination_pattern.match(destination) is not None:
                matched_rules.append(rule)

        data.context.matched_rules = matched_rules

        has_paths = len(matched_rules) > 0 and "paths" in matched_rules[0]

        if has_paths:
            return

        applied_rule = matched_rules[0] if len(matched_rules) > 0 else None

        if applied_rule is not None:
            applied_rule_name = applied_rule.get("name", "Name not configured")
        else:
            applied_rule_name = f"Default Policy - {default_policy}"

        if applied_rule is not None:
            block = applied_rule["action"] == "block"
        else:
            block = default_policy == "block-all"

        if block:
            event = {
                "action": "block",
                "destination": destination,
                "scheme": "https",
                "rule_name": applied_rule_name,
            }
            data.context.action = "block"
            if self.mode == "audit":
                data.ignore_connection = True
        else:
            event = {
                "action": "allow",
                "destination": destination,
                "scheme": "https",
                "rule_name": applied_rule_name,
            }
            data.ignore_connection = True
            data.context.action = "allow"

        self.queue.put(event)

    def tls_start_client(self, data):
        logging.info("tls_start_client")
        action = data.context.action
        if action == "block" and self.mode != "audit":
            data.ssl_conn = SSL.Connection(SSL.Context(SSL.SSLv23_METHOD))
            data.conn.error = "TLS Handshake failed"

    # pylint: disable=too-many-branches,too-many-locals
    def request(self, flow):
        allow_http = self.allow_http
        default_policy = self.default_policy

        sni = flow.client_conn.sni
        host = flow.request.pretty_host
        destination = sni if sni is not None else host
        scheme = flow.request.scheme
        request_path = flow.request.path

        if (not allow_http) and scheme == "http":
            event = {
                "action": "block",
                "destination": destination,
                "scheme": "http",
                "rule_name": "allow_http is False",
            }
            self.queue.put(event)
            if self.mode != "audit":
                flow.kill()
            return

        block = default_policy == "block-all"
        break_flag = False
        applied_rule = None

        for rule in self.egress_rules:
            destination_pattern = self.wildcard_to_regex(rule["destination"])
            if destination_pattern.match(destination) is not None:
                paths = rule.get("paths", [])
                # Disable path based rules for now.
                paths = []
                if len(paths) == 0:
                    block = rule["action"] == "block"
                    applied_rule = rule
                    break
                for path in paths:
                    path_regex = self.wildcard_to_regex(path)
                    if path_regex.match(request_path) is not None:
                        block = rule["action"] == "block"
                        applied_rule = rule
                        break_flag = True
                        break
                if break_flag:
                    break

        if applied_rule is not None:
            applied_rule_name = applied_rule.get("name", "Name not configured")
        else:
            applied_rule_name = f"Default Policy - {default_policy}"

        if block:
            event = {
                "action": "block",
                "destination": destination,
                "scheme": scheme,
                "rule_name": applied_rule_name,
            }
            if self.mode != "audit":
                flow.kill()
        else:
            event = {
                "action": "allow",
                "destination": destination,
                "scheme": scheme,
                "rule_name": applied_rule_name,
            }

        self.queue.put(event)


addons = [Interceptor()]  # pylint: disable=invalid-name
