terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = { Project = var.project }
  }
}

variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

# Prefix for resource names
variable "project" {
  type    = string
  default = "task-manager"
}
