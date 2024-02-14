const fs = require('fs')

async function createInterceptDotPy() {
  const interceptDotPy = `
import json
import logging
from queue import Queue
import re
from threading import Lock
from threading import Thread
import time
from OpenSSL import SSL
import os

from mitmproxy import ctx

import ruamel.yaml


FILE_WORKERS = 5

class Interceptor:
    def __init__(self):
        self.outfile = None
        self.encode = None
        self.url = None
        self.lock = None
        self.auth = None
        self.queue = Queue()
        self.egress_rules = None
        self.mode = 'audit'
        self.default_policy = 'block-all'
        with open('egress_rules.yaml', 'r') as file:
            yaml = ruamel.yaml.YAML(typ="safe", pure=True)
            self.egress_rules = yaml.load(file)

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
        elif isinstance(obj, list) or isinstance(obj, tuple):
            return [cls.convert_to_strings(element) for element in obj]
        elif isinstance(obj, bytes):
            return str(obj)[2:-1]
        return obj

    def worker(self):
        while True:
            frame = self.queue.get()
            self.dump(frame)
            self.queue.task_done()

    def dump(self, frame):
        frame["mode"] = self.mode
        frame["timestamp"] = time.strftime('%X %x %Z')
        frame = self.convert_to_strings(frame)

        if self.outfile:
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
        self.outfile = open(ctx.options.dump_destination, "a")
        self.lock = Lock()
        logging.info("Writing all data frames to %s" % ctx.options.dump_destination)

        for i in range(FILE_WORKERS):
            t = Thread(target=self.worker)
            t.daemon = True
            t.start()

    def wildcard_to_regex(self, wildcard_domain):
        regex_pattern = re.escape(wildcard_domain)  # Escape special characters
        regex_pattern = regex_pattern.replace(r'\*', '.*')  # Replace wildcard with regex equivalent
        regex_pattern =  '^' + regex_pattern + '$'  # Ensure the pattern matches the entire string
        return re.compile(regex_pattern)

    def tls_clienthello(self, data):
        default_policy = self.default_policy

        matched_rules = []

        for rule in self.egress_rules:
            domain_pattern = self.wildcard_to_regex(rule['domain'])
            domain = data.client_hello.sni
            if domain_pattern.match(domain) is not None:
                matched_rules.append(rule)


        data.context.matched_rules = matched_rules

        has_paths = len(matched_rules) > 0 and 'paths' in matched_rules[0]
        
        if has_paths:
            return

        applied_rule = matched_rules[0] if len(matched_rules) > 0 else None
        applied_rule_name = applied_rule.get("name", "Name not configured") if applied_rule is not None else f"Default Policy - {default_policy}"

        block = applied_rule["action"] == "block" if applied_rule is not None else default_policy == 'block-all'

        if block:
            event = {
                "action": "block",
                "domain": domain,
                "scheme": "https",
                "rule_name": applied_rule_name,
            }
            data.context.action = "block"
            if self.mode == "audit":
                data.ignore_connection = True
        else:
            event = {
                "action": "allow",
                "domain": domain,
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
            data.conn.error = f'TLS Handshake failed'

    def request(self, flow):
        allow_http = False
        default_policy = self.default_policy

        sni = flow.client_conn.sni
        host = flow.request.pretty_host
        domain = sni if sni is not None else host
        scheme = flow.request.scheme
        request_path = flow.request.path


        if (not allow_http) and scheme == "http":
            event = {
                "action": "block",
                "domain": domain,
                "scheme": "http",
                "rule_name": "allow_http is False"
            }
            self.queue.put(event)
            if self.mode != "audit":
                flow.kill()
            return
        
        block = default_policy == 'block-all'
        breakFlag =  False
        applied_rule = None

        for rule in self.egress_rules:
            domain_pattern = self.wildcard_to_regex(rule['domain'])
            if domain_pattern.match(domain) is not None:
                paths = rule.get('paths', [])
                if  len(paths) == 0:
                    block = rule['action'] == 'block'
                    applied_rule = rule
                    break
                for path in paths:
                    path_regex = self.wildcard_to_regex(path)
                    if path_regex.match(request_path) is not None:
                        block = rule['action'] == 'block'
                        applied_rule = rule
                        breakFlag = True
                        break
                if breakFlag:
                    break

        applied_rule_name = applied_rule.get("name", "Name not configured") if applied_rule is not None else f"Default Policy - {default_policy}"

        if block:
            event = {
                "action": "block",
                "domain": domain,
                "scheme": scheme,
                "rule_name": applied_rule_name
            }
            if self.mode != "audit":
                flow.kill()
        else:
            event = {
                "action": "allow",
                "domain": domain,
                "scheme": scheme,
                "rule_name": applied_rule_name
            }

        self.queue.put(event)

addons = [Interceptor()]  # pylint: disable=invalid-name
`
  fs.writeFileSync('intercept.py', interceptDotPy)
}

module.exports = { createInterceptDotPy }
