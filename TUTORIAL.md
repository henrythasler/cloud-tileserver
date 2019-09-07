# Tutorial

This tutorial will explain step-by-step, how to set-up the tileserver and all dependencies. Some day...

## Prerequisites

To set up the whole environment you will need:

- Account with [Amazon Web Services (AWS) - Cloud Computing Services](https://aws.amazon.com). Make sure you set up [Multi-Factor Authentication](https://aws.amazon.com/iam/details/mfa/) to ensure account security!
- [Node.js® JavaScript runtime](https://nodejs.org/en/) installed on your local machine.
- [AWS Command Line Interface](https://aws.amazon.com/cli/) installed on your local machine.
- [Terraform](https://learn.hashicorp.com/terraform/getting-started/install.html) installed on your local machine.
- A database with imported and preprocessed openstreetmap-data that is accessible from your AWS account. It could be a RDS-Instance in AWS or something totally different with another provider.

## Initial Setup

### AWS Credentials

- go to IAM and create a new user
- create an access key for that user
- run `aws configure` and enter the access keys incl. secret key as prompted.
