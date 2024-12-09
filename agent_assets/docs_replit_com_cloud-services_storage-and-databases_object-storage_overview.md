URL: https://docs.replit.com/cloud-services/storage-and-databases/object-storage/overview
---
[Skip to main content](#__docusaurus_skipToContent_fallback)

On this page

# Overview

Object Storage is a data storage architecture that manages data as Objects. In Object Storage, data is stored in containers called Buckets, which can hold any number of Objects. Each Object consists of data, metadata, and a unique identifier.

Object Storage is commonly used for storing large amounts of unstructured data, such as images, videos, documents, backups, and log files. It provides scalable and highly available storage, making it suitable for Cloud-based applications and services.

## Introduction [​](/cloud-services/storage-and-databases/object-storage/overview\#introduction "Direct link to Introduction")

Object Storage on Replit provides a seamless way to store files persistently, allowing you to access your data across different environments, including development (the Replit Workspace) and production (Deployments). The table below helps you understand the problem and how the Object Storage solution resolves it.

| **Problem** | **Object Storage Solution** |
| --- | --- |
| Your data gets wiped out with every redeployment | Your data persists across deployments, providing reliability and continuity |
| Storing simple data without using complex databases | A straightforward solution for storing JSON or text files without the database overhead |
| Need to store and serve images in your web applications | Easily store and retrieve images, seamlessly integrating them into your applications |
| Sharing data between development and production environments | Centralized storage for effortless data sharing across different environments |

## Architecture [​](/cloud-services/storage-and-databases/object-storage/overview\#architecture "Direct link to Architecture")

This section focuses on understanding the architecture of Object Storage and its components: Objects, Buckets, Repls, and Deployments.

### Model [​](/cloud-services/storage-and-databases/object-storage/overview\#model "Direct link to Model")

![](https://docimg.replit.com/images/programming-ide/workspace-features/object-storage/object-storage-architecture.png)

The following are the components of Object Storage:

- **Objects**

Objects are files stored in the Replit system. They can be text files, images, configuration files, or any other data you want to save. When you perform actions like reading from or writing to files, you're working with Objects.

- **Buckets**

Buckets are containers that hold multiple Objects. Imagine them as folders where you organize related files. When using Replit libraries, the default Bucket is automatically selected unless otherwise specified, and no configuration is needed. You'll see the default configuration in the `.replit` file as shown below:

```codeBlockLines_e6Vv
[objectStorage]
defaultBucketID = "replit-objstore-2671be20-ff2f-4b45-b882-bc823dc5b905"

```

- **Repls and Deployments**

Repls and Deployments are environments provided by Replit for executing code and hosting web applications. When working with Objects, Repls, and Deployments, the first step is to access a Bucket, and then you can manage the Objects stored within it.

## Getting started [​](/cloud-services/storage-and-databases/object-storage/overview\#getting-started "Direct link to Getting started")

Login to your [Replit Workspace](https://replit.com/~) and create a Repl. Refer to [Introduction to workspace](https://docs.replit.com/replit-workspace/introduction-to-the-workspace) for the detailed steps.

Navigate to the **Tools** pane to find **Object Storage**. Alternatively, in any window, use the **+** sign to open a new tab and search for **Object Storage**.

![](https://docimg.replit.com/images/programming-ide/workspace-features/object-storage/object-storage-tool.png)

Select the **Create a Bucket** button to create your Bucket.

![](https://docimg.replit.com/images/programming-ide/workspace-features/object-storage/create-a-bucket.png)

Once you create a Bucket, a Bucket ID is generated. To view the Bucket ID, navigate to the **Settings** tab.

note

You can also delete the Bucket anytime, but remember that this action cannot be undone.

![](https://docimg.replit.com/images/programming-ide/workspace-features/object-storage/view-bucket-id.png)

### Manage Objects [​](/cloud-services/storage-and-databases/object-storage/overview\#manage-objects "Direct link to Manage Objects")

Depending on your preferences and requirements, you can manage Objects by uploading, downloading, and deleting Objects within your Bucket using the Replit Object Storage Library or GCS APIs.

The Replit Object Storage libraries provide:

- A simplified interface for interacting with your Bucket
- Making it easier to perform common tasks like uploading, downloading, and deleting Objects

On the other hand, using GCS APIs directly gives you more control and flexibility over your Object management operations. This approach allows you to access advanced features and functionality provided by GCS, such as preconditions and lifecycle management. Using the GCS APIs is recommended if you are using a language other than [Python](/cloud-services/storage-and-databases/object-storage/python-api-reference/) or [Typescript](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/) and cannot use a Replit library, or if you require more advanced functionality. You can read more about the GCS APIs [here](https://cloud.google.com/storage/docs/reference/libraries). Using GCS APIs directly enables access from environments where it isn't possible to use a Replit library, such as other programming languages (i.e., Go or Java) or shell scripts.

In your Replit Workspace, you can start uploading files by dragging and dropping them into the Object Storage window or selecting **Upload files** or **Upload folder**. You can view all the files once you upload your folder/files. You can also organize all your files using the **Create folder** button. If you wish to delete a specific file, use the _trashcan_ option against the specific file on the right side.

![](https://docimg.replit.com/images/programming-ide/workspace-features/object-storage/uploaded-files.png)

## Using Replit Object Storage Library [​](/cloud-services/storage-and-databases/object-storage/overview\#using-replit-object-storage-library "Direct link to Using Replit Object Storage Library")

The Replit Object Storage Library is available in Python and TypeScript. It helps you perform basic file operations. Use the [Python library](/cloud-services/storage-and-databases/object-storage/python-api-reference) to create a client instance, get the default Bucket associated with the Repl, write data to an Object named `file.txt`, and then read data from the same Object.

In your Repl Workspace, navigate to the **Commands** tab to install the **Replit Object Storage Package**. The `replit-object-storage` package simplifies working with Object Storage by providing a Python client library. Learn more about the package by referring to the [Replit Object Storage package overview](/cloud-services/storage-and-databases/object-storage/python-api-reference/).

The following example helps you understand how your files interact with Replit Object Storage using Python.

```codeBlockLines_e6Vv

# Import the Replit Object Storage Library
from replit.object_storage import Client

# Create a client instance
client = Client()

# Write data to an Object with the name "file.txt"
client.upload_from_text("file.txt", file_contents)

# Read data from the Object named "file.txt"
obj = client.download_from_text("file.txt")
print("Content of 'file.txt':", obj)

```

Similarly, you can also use the [Replit Object Storage Client library in Typescript](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/) and other languages.

If you don't find a client library for the language of your choice, use one of the [GCS Client Libraries](https://cloud.google.com/storage/docs/reference/libraries) or the [GCS JSON API](https://cloud.google.com/storage/docs/json_api).

- [Introduction](/cloud-services/storage-and-databases/object-storage/overview#introduction)
- [Architecture](/cloud-services/storage-and-databases/object-storage/overview#architecture)
  - [Model](/cloud-services/storage-and-databases/object-storage/overview#model)
- [Getting started](/cloud-services/storage-and-databases/object-storage/overview#getting-started)
  - [Manage Objects](/cloud-services/storage-and-databases/object-storage/overview#manage-objects)
- [Using Replit Object Storage Library](/cloud-services/storage-and-databases/object-storage/overview#using-replit-object-storage-library)