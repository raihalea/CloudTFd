import aws_cdk as core
import aws_cdk.assertions as assertions

from cloudtfd.cloudtfd_stack import CloudTFdStack

# example tests. To run these tests, uncomment this file along with the example
# resource in cloud_t_fd/cloud_t_fd_stack.py
def test_sqs_queue_created():
    app = core.App()
    stack = CloudTFdStack(app, "cloud-t-fd")
    template = assertions.Template.from_stack(stack)

#     template.has_resource_properties("AWS::SQS::Queue", {
#         "VisibilityTimeout": 300
#     })
