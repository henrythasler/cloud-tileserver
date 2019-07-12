provider "aws" {
  version = "~> 2.16"
  profile = "default"
  region  = var.region
}


resource "aws_lambda_function" "tileserver" {
  function_name    = "tileserver"
  runtime          = "nodejs10.x"
  filename         = "./../dist/function.zip"
  role             = "arn:aws:iam::324094553422:role/service-role/tileserver-role-lti41jke"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../dist/function.zip")}"
}
