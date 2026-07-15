# Security Policy

## Supported Versions

Security fixes are provided for the latest minor release of Graveyard Check.
Users should upgrade to the newest published version before reporting an issue
that may already have been resolved.

| Version | Supported |
| ------- | --------- |
| 0.2.x   | Yes       |
| 0.1.x   | No        |

## Reporting a Vulnerability

Please do not report suspected vulnerabilities through a public GitHub issue,
discussion, pull request, or social media post.

Report them privately by emailing
[tahakotwal54@gmail.com](mailto:tahakotwal54@gmail.com) with the subject:

> Security report: Graveyard Check

Include as much of the following information as possible:

- The affected Graveyard Check version
- The operating system and Node.js version
- A clear description of the vulnerability and its potential impact
- Steps or a minimal proof of concept that reproduces the issue
- Any conditions required to exploit it
- A suggested fix or mitigation, if known
- Whether the vulnerability has been disclosed anywhere else
- How you would like to be credited

Do not include real credentials, access tokens, private repository contents, or
other sensitive third-party data in a report. Use redacted or synthetic test
data.

## What to Expect

- Receipt of a report will normally be acknowledged within three business days.
- The report will be investigated and its severity assessed.
- The reporter will receive a status update within seven business days when
  practical.
- Valid vulnerabilities will be addressed according to their severity and
  released through npm.
- A GitHub Security Advisory and CVE may be published when appropriate.
- Credit will be given with the reporter's permission.

These are response targets rather than guarantees. Complex reports may require
additional investigation.

## Coordinated Disclosure

Please allow reasonable time to investigate and release a fix before publicly
disclosing a vulnerability. The maintainer will coordinate a disclosure date
with the reporter when practical.

Once a fix is available, users should update with:

```bash
npm install graveyard-check@latest
```

## Scope

Examples of issues that are in scope include:

- Arbitrary code execution caused by Graveyard Check
- Command or path injection
- Unsafe processing of lockfiles, requirements files, registry responses, or
  successor dataset records
- Exposure of `GITHUB_TOKEN` or other credentials
- Unauthorized network requests or transmission of local project data
- Dependency vulnerabilities that are exploitable through Graveyard Check
- Published-package or build-pipeline integrity issues

The following are generally out of scope:

- Abandonment verdict disagreements without a security impact
- Incorrect or outdated successor recommendations
- Vulnerabilities in packages merely reported by Graveyard Check
- GitHub, npm, or PyPI availability and rate limits
- Social engineering, denial-of-service flooding, or attacks requiring physical
  access to a user's device
- Reports generated only by automated scanners without a reproducible impact

Dataset accuracy problems should be reported through a regular GitHub issue or
pull request unless they create a concrete security risk.

## Safe Harbor

Security research performed in good faith and in accordance with this policy
will be considered authorized. Please:

- Make a good-faith effort to avoid privacy violations, data destruction,
  service disruption, and access beyond what is necessary to demonstrate the
  issue
- Test only against systems and accounts you own or have explicit permission to
  use
- Stop testing and report the issue if you encounter sensitive data
- Do not exploit a vulnerability beyond the minimum needed to confirm it

The project will not pursue legal action against researchers who follow these
guidelines. This safe harbor does not authorize activity against third-party
systems, including GitHub, npm, or PyPI.
