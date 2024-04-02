![Bolt](assets/imgs/bolt-header-light.png#gh-light-mode-only)
![Bolt](assets/imgs/bolt-header-dark.png#gh-dark-mode-only)
## Secure GitHub actions with 1 line of code
Add this step to jobs in your GitHub workflow file(s) to secure your runner:
```yaml
  - name: Setup Bolt
    uses: koalalab-inc/bolt@v1
```

## Transparent Egress Gateway for GitHub hosted runners

Bolt is a transparent egress gateway that can be used to control the egress traffic from GitHub hosted runners. It is packaged as a GitHub Action, which means you can easily add it to your workflows and start controlling the egress traffic from your pipelines.

> [!NOTE]
> 
> Supports both public and private repositories


## Why?

Complex CI/CD environments are under increasing threat due to increase in software supply chain attacks. Modern CI/CDs (GitHub CI) allow third-party code in highly privledged CI environment.

GitHub hosted runners are a great way to run your CI/CD pipelines. However, they are not without their limitations. One of the most notable limitations is the lack of egress control. This means that any code running on a GitHub hosted runner can make requests to any external service. This can be a security risk, especially when running untrusted code.

## Usage
You can start using Bolt by adding the `koalalab-inc/bolt` action as the first step in the jobs you want to monitor. The action will install and start the Bolt service on the runner. Checkout the configuration options and defaults [here](#Configure).

```yaml
  - name: Setup Bolt
    uses: koalalab-inc/bolt@v1
```

![bolt-usage-before-after.png](assets/imgs/bolt-usage-before-after.png)

## Configure
You can configuree the Bolt action using inputs. Here is an example of how to configure the action.

```yaml
  - name: Setup Bolt
    uses: koalalab-inc/bolt@v1
    with:
      mode: 'audit'
      default_policy: 'block-all'
      allow_http: 'false'
      trusted_github_accounts: |
        - 'akto-api-security'
      egress_rules: |
        - name: 'Allow GitHub subs'
          destination: '*.github.com'
          action: 'allow'
```
| Option | Description  |
---------------------------------|---------------------------------
| `mode` | Configure the mode of operation for the Bolt gateway. It can be `audit` or `active`. Default: `audit` |
| `default_policy` | It can be either `block-all` or `allow-all`. Default: `block-all` |
| `allow_http` | Whether to allow non-secure HTTP requests or not. Default: `false`
| `trusted_github_accounts` | A list of trusted GitHub accounts.  Default: `[]`. The account in which workflow is running will always be trusted.
| `egress_rules` | A list of custom egress rules to be applied. Default: `[]`.

## Custom Egress Policy
You can define custom egress rules to control the egress traffic from your pipelines. Here is an example of how to define custom egress rules.

In `audit` mode, the Bolt gateway will log the egress traffic as per the defined rules. In `active` mode, the Bolt gateway will enforce the defined rules.

Egress rule options:
| Option | Description  |
---------------------------------|---------------------------------
| `name` | A name for the rule |
| `destination` | The destination domain or IP address. `*` wilcard is supported in destination. |
| `action` | The action to be taken. It can be `allow` or `block` |

It is an ordered list of rules. The first rule that matches the destination will be applied.


```yaml
  - name: Setup Bolt
    uses: koalalab-inc/bolt@v1
    with:
      mode: 'audit'
      default_policy: 'block-all'
      allow_http: 'false'
      egress_rules: |
        - name: 'Allow GitHub subdomains'
          destination: '*.github.com'
          action: 'allow'
        - name: 'Block api subdomain'
          destination: 'api.example.com'
          action: 'block'
        - name: 'Allow other subdomains'
          destination: '*.example.com'
          action: 'allow'
```

## Report
Once the job is over, bolt will add a egress traffic report to the job summary. The report will show the egress traffic and the rules that were applied. A sample report is shown below.

### Egress Report - powered by Bolt
#### Bolt Configuration

|Option | Value |
|---|---|
| Mode | audit |
| Default Policy | block-all |
| Allow HTTP | false |

#### Custom Egress Rules
```yaml
- name: 'Allow ifconfig.me'
  action: 'allow'
  destinatiom: 'ifconfig.me'
```
#### Egress Traffic
> [!NOTE]
>
> Running in Audit mode. Unverified destinations will be blocked in Active mode.
<table><tr><th>Destination</th><th>Scheme</th><th>Rule</th><th>Action</th></tr><tr><td>github.com</td><td>https</td><td>Reqd by GitHub Action</td><td>✅</td></tr><tr><td>packages.microsoft.com</td><td>https</td><td>Default Policy - block-all</td><td>Unknown Destination</td></tr><tr><td>results-receiver.actions.githubusercontent.com</td><td>https</td><td>Reqd by GitHub Action</td><td>✅</td></tr><tr><td>ppa.launchpadcontent.net</td><td>https</td><td>Default Policy - block-all</td><td>Unknown Destination</td></tr><tr><td>esm.ubuntu.com</td><td>https</td><td>Default Policy - block-all</td><td>Unknown Destination</td></tr><tr><td>azure.archive.ubuntu.com</td><td>http</td><td>allow_http is False</td><td>Unknown Destination</td></tr><tr><td>www.google.com</td><td>https</td><td>Default Policy - block-all</td><td>Unknown Destination</td></tr><tr><td>ifconfig.me</td><td>https</td><td>Allow ifconfig.me</td><td>✅</td></tr><tr><td>pipelinesghubeus6.actions.githubusercontent.com</td><td>https</td><td>Reqd by GitHub Action</td><td>✅</td></tr></table>
