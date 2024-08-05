![Bolt](assets/imgs/bolt-header-dark.png)
[![OSSF-Scorecard Score](https://img.shields.io/ossf-scorecard/github.com/koalalab-inc/bolt?label=openssf%20scorecard)](https://api.securityscorecards.dev/projects/github.com/koalalab-inc/bolt)
![GitHub License](https://img.shields.io/github/license/koalalab-inc/bolt)

# BOLT:Secure GitHub Actions Runtime with 1 line of code
BOLT is an egress-filter and runtime security tool for your GitHub Actions environment.
### Usage
Add this step to jobs in your GitHub workflow file(s) to secure your runner:
```yaml
  - name: Setup Bolt
    uses: koalalab-inc/bolt@v1
```

BOLT is packaged as a GitHub Action, which means you can easily add it to your workflows and start controlling the egress traffic from your pipelines.

> [!NOTE]
> 
> Supports both public and private repositories

## Why use BOLT?
Ther aftermath of [Solarwinds breach](https://en.wikipedia.org/wiki/2020_United_States_federal_government_data_breach) has led to [an increase in software supply chain attacks](https://linuxfoundation.eu/newsroom/the-rising-threat-of-software-supply-chain-attacks-managing-dependencies-of-open-source-projects). 

CI/CD pipelines are the infrastructure of which the software is built, they are the keys to the cloud kingdom, and are high-leverage attack surfaces.

[OWASP top 10 CI/CD](https://owasp.org/www-project-top-10-ci-cd-security-risks/) and [CISA+NSA's joint guidance on defending CI/CD](https://www.cisa.gov/news-events/alerts/2023/06/28/cisa-and-nsa-release-joint-guidance-defending-continuous-integrationcontinuous-delivery-cicd) are really great starting points to understand the threat vectors surrounding CI/CD. An adaption of the same for GitHub environment would look a little like:

![CI:CD Threat Vectors](https://github.com/user-attachments/assets/99ed2591-6f8f-45f0-b6be-5e8133c19f96)

and specifically focussing on the CI runtime threat vectors(and their solution):

![CI Runtime Threat Vectors](https://github.com/user-attachments/assets/c115b4d1-d42c-4e72-85a4-b61eeda83371)

BOLT covers both the threat vectors by

1. Transparent Egress filtering mechanism which allows traffic only to trusted domains
2. Detection of actions with Sudo permissions to prevent against file-tampering during build time.


## How to use Bolt - Video Introduction

https://github.com/koalalab-inc/bolt/assets/2908925/7bf51186-e673-4bed-9b56-ae15c7ab9154


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
      egress_rules: |
        - name: 'Allow GitHub subs'
          destination: '*.github.com'
          action: 'allow'
      disable_passwordless_sudo: 'false'
      default_policy: 'block-all'
      allow_http: 'false'
      graceful: 'true'
```
| Option | Description  |
---------------------------------|---------------------------------
| `mode` | Configure the mode of operation for the Bolt gateway. It can be `audit` or `active`. Default: `audit` |
| `egress_rules` | A list of custom egress rules to be applied. Default: `[]`.
| `disable_passwordless_sudo` | Whether to disable passwordless sudo or not. Default: `false` |
| `allow_http` | Whether to allow non-secure HTTP requests or not. Default: `false`
| `default_policy` | It can be either `block-all` or `allow-all`. Default: `block-all` |
| `graceful` | Whether to gracefully fail in case of unsupported platforms or not. Default: `true` |

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

## Report in workflow logs
Once the job is over, bolt will add a egress traffic report to the job summary. The report will show the egress traffic and the rules that were applied. A sample report is shown below.

<hr>

<h2>⚡ Egress Report - powered by Bolt</h2>

<details open>
  <summary>
<h3>🛠️ Bolt Configuration</h3>

  </summary>
<table><tr><td>Mode</td><td>audit</td></tr><tr><td>Allow HTTP</td><td>false</td></tr><tr><td>Default Policy</td><td>block-all</td></tr></table>

</details>
    
<h3>📝 Egress rules</h3>
<pre lang="yaml"><code>- destination: google.com
  action: block
  name: Block Google
- destination: ifconfig.me
  action: allow
  name: Allow ifconfig.me</code></pre>

<h3>Egress Traffic</h3>
<blockquote>NOTE: Running in Audit mode. Unknown/unverified destinations will be blocked in Active mode.</blockquote>

<details open>
  <summary>
<h4>🚨 Unknown Destinations</h4>

  </summary>
<table><tr><th>Destination</th><th>Scheme</th><th>Rule</th><th>Action</th></tr><tr><td>www.google.com</td><td>https</td><td>Default Policy - block-all</td><td>Unknown Destination</td></tr></table>

</details>
    
<details>
  <summary>
<h4>✅ Known Destinations</h4>

  </summary>
<table><tr><th>Destination</th><th>Scheme</th><th>Rule</th><th>Action</th></tr><tr><td>github.com</td><td>https</td><td>Reqd by Github Action</td><td>✅</td></tr><tr><td>pipelinesghubeus6.actions.githubusercontent.com</td><td>https</td><td>Reqd by Github Action</td><td>✅</td></tr><tr><td>results-receiver.actions.githubusercontent.com</td><td>https</td><td>Reqd by Github Action</td><td>✅</td></tr><tr><td>ifconfig.me</td><td>https</td><td>Allow ifconfig.me</td><td>✅</td></tr><tr><td>api.github.com</td><td>https</td><td>Reqd by Github Action</td><td>✅</td></tr></table>

</details>
    <a href="https://www.koalalab.com">View detailed analysis of this run on Koalalab!</a>
<hr>

This report was generated using this workflow file: [bolt-sample.yml](examples/bolt.yml)

<hr>

> [!NOTE]
> 
> We have removed SSL inspection features from Bolt. It had some compatibility issues with certain package managers. We will soon release a new version with improved SSL inspection capabilities.


## Usage and Limitations

BOLT is available to use for private as well as public repository on Github hosted ubuntu runners. Contact us if you want to use BOLT on self-hosted runners.
