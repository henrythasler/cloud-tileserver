provider "aws" {
  version = "~> 2.16"
  profile = "default"
  region  = var.region
}

resource "aws_iam_role" "tileserver_role" {
  name = "tileserver_role"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
  tags = {
    tag-key = "tag-value"
  }
}

resource "aws_iam_role_policy_attachment" "exec-role" {
  role = "${aws_iam_role.tileserver_role.name}"
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# resource "aws_iam_role_policy_attachment" "vpcAccess" {
#     role       = "${aws_iam_role.tileserver_role.name}"
#     policy_arn = "arn:aws:iam::aws:policy/AmazonVPCFullAccess"
# }

# resource "aws_iam_role_policy_attachment" "rdsAccess" {
#     role       = "${aws_iam_role.tileserver_role.name}"
#     policy_arn = "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
# }


resource "aws_lambda_layer_version" "tileserver_layer" {
  filename = "../dist/tileserver_layer.zip"
  layer_name = "tileserver_layer"
  source_code_hash = "${filebase64sha256("../dist/tileserver_layer.zip")}"
  compatible_runtimes = ["nodejs10.x"]
}

resource "aws_lambda_function" "tileserver" {
  function_name = "tileserver"
  runtime = "nodejs10.x"
  filename = "./../dist/function.zip"
  role = "${aws_iam_role.tileserver_role.arn}"
  handler = "index.handler"
  source_code_hash = "${filebase64sha256("./../dist/function.zip")}"
  layers = ["${aws_lambda_layer_version.tileserver_layer.arn}"]
  vpc_config {
    subnet_ids = ["subnet-0fd5e742", "subnet-19dd2d73", "subnet-81d6f9fc"]
    security_group_ids = ["sg-61e63b00"]
  }
  environment {
    variables = {
      PGDATABASE = var.database_local
      PGHOST = var.postgres_host
      PGPASSWORD = var.postgres_password
      PGUSER = var.postgres_user
    }
  }
}

resource "aws_lambda_permission" "allow_api_gateway" {
     statement_id  = "AllowExecutionFromAPIGateway"
     action        = "lambda:InvokeFunction"
     function_name = "${aws_lambda_function.tileserver.function_name}"
     principal     = "apigateway.amazonaws.com"
     source_arn = "${aws_api_gateway_rest_api.example.execution_arn}/*/*/*"
     
}

resource "aws_api_gateway_rest_api" "example" {
  name = "ServerlessExample"
  description = "Terraform Serverless Application Example"
  binary_media_types = [
    "*/*"
  ]
  endpoint_configuration {
    types = [
      "REGIONAL"
    ]
  }
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  parent_id = "${aws_api_gateway_rest_api.example.root_resource_id}"
  path_part = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  resource_id = "${aws_api_gateway_resource.proxy.id}"
  http_method = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  resource_id = "${aws_api_gateway_method.proxy.resource_id}"
  http_method = "${aws_api_gateway_method.proxy.http_method}"

  integration_http_method = "POST"
  type = "AWS_PROXY"
  uri = "${aws_lambda_function.tileserver.invoke_arn}"
}

resource "aws_api_gateway_method" "proxy_root" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  resource_id = "${aws_api_gateway_rest_api.example.root_resource_id}"
  http_method = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_root" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  resource_id = "${aws_api_gateway_method.proxy_root.resource_id}"
  http_method = "${aws_api_gateway_method.proxy_root.http_method}"

  integration_http_method = "POST"
  type = "AWS_PROXY"
  uri = "${aws_lambda_function.tileserver.invoke_arn}"
}

resource "aws_api_gateway_deployment" "example" {
  depends_on = [
    "aws_api_gateway_integration.lambda",
    "aws_api_gateway_integration.lambda_root",
  ]

  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  stage_name = "test"
}


resource "aws_lambda_permission" "apigw" {
  statement_id = "AllowAPIGatewayInvoke"
  action = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.tileserver.arn}"
  principal = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_deployment.example.execution_arn}/*/*"
}

output "base_url" {
  value = "${aws_api_gateway_deployment.example.invoke_url}"
}

# http://www-0000.s3-website.eu-central-1.amazonaws.com
resource "aws_s3_bucket" "website" {
  bucket = var.sitename
  acl = "public-read"
  force_destroy = true

  website {
    index_document = "index.html"
    error_document = "error.html"
  }
  provisioner "local-exec" {
    command = "aws s3 cp ../html/ s3://${aws_s3_bucket.website.bucket}/ --recursive"
  }
}

resource "aws_s3_bucket_policy" "website_policy" {
  bucket = "${aws_s3_bucket.website.id}"
  policy = <<EOF
{
  "Version":"2012-10-17",
  "Id": "PolicyForPublicWebsiteContent",
  "Statement":[
    {
      "Sid":"PublicReadGetObject",
      "Effect":"Allow",
      "Principal": {
               "AWS": "*"
           },
      "Action":["s3:GetObject"],
      "Resource":["${aws_s3_bucket.website.arn}/*"]
      }
  ]
}
EOF
}

# resource "aws_s3_bucket_object" "index" {
#   bucket = "${aws_s3_bucket.www_0000.id}"
#   acl    = "public-read"
#   key    = "index.html"
#   source = "../html/index.html"
#   etag   = "${filemd5("../html/index.html")}"
#   content_type = "text/html"
# }
