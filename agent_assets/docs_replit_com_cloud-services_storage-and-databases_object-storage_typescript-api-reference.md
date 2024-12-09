URL: https://docs.replit.com/cloud-services/storage-and-databases/object-storage/typescript-api-reference/
---
[Skip to main content](#__docusaurus_skipToContent_fallback)

On this page

# Object Storage Typescript SDK

## Overview [​](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/\#overview "Direct link to Overview")

The `@replit/object-storage` package offers a TypeScript client library to interact with Object Storage. It provides a quick and efficient way to integrate Object Storage into Node.js applications. While it's feasible to utilize Object Storage via the [Google Node.js Client for Cloud Storage](https://cloud.google.com/nodejs/docs/reference/storage/latest) or the [Google Cloud Storage JSON API](https://cloud.google.com/storage/docs/json_api), the Replit client library streamlines application development with Object Storage by eliminating the need for custom authentication logic and Bucket configuration.

note

This package is intended for server-side applications only. It leverages Node.js features and native filesystem functionalities, making it incompatible with browser environments.

## Installation [​](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/\#installation "Direct link to Installation")

The Object Storage Typescript SDK is available via the `@replit/object-storage` package in [NPM](https://www.npmjs.com/package/@replit/object-storage).

You can install the Object Storage package by using one of the following methods:

### One-click Setup [​](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/\#one-click-setup "Direct link to One-click Setup")

Navigate to your Workspace, select **+** to add a new tab, and search for **Object Storage**. In the Object Storage pane, use the one-click setup **Install @replit/object-storage package** button to install the package.

![](https://docimg.replit.app/images/hosting/object-storage/install-javascript.png)

### Using npm [​](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/\#using-npm "Direct link to Using npm")

You can install the package via the shell using npm:

```codeBlockLines_e6Vv
npm install @replit/object-storage

```

### Using yarn [​](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/\#using-yarn "Direct link to Using yarn")

```codeBlockLines_e6Vv
yarn add @replit/object-storage

```

The library is compatible with [Bun](https://replit.com/@replit/Bun?v=1), [Deno](https://replit.com/@replit/Deno?v=1), and [NodeJS](https://replit.com/@replit/Nodejs?v=1) (Node version 14+).

## Quick Start [​](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/\#quick-start "Direct link to Quick Start")

Follow this guide to set up the Object Storage TypeScript SDK and perform basic operations like adding, retrieving, listing, and deleting Objects in your Bucket.

### Setup a Client [​](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/\#setup-a-client "Direct link to Setup a Client")

Create a new client instance without any parameters:

```codeBlockLines_e6Vv
import { Client } from '@replit/object-storage';
const client = new Client();

```

### Add an Object [​](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/\#add-an-object "Direct link to Add an Object")

Upload an Object by providing its name and contents:

```codeBlockLines_e6Vv
const { ok, error } = await client.uploadFromText('file.txt', "Hello World!")
if (!ok) {
    // ... handle the error ...
}

```

### Get an Object [​](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/\#get-an-object "Direct link to Get an Object")

Retrieve an Object's contents as text:

```codeBlockLines_e6Vv
const { ok, value, error } = await client.downloadAsText('file.txt');
if (!ok) {
    // ... handle the error ...
}
console.log(value);
// > "Hello World!"

```

### List the Objects in the Bucket [​](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/\#list-the-objects-in-the-bucket "Direct link to List the Objects in the Bucket")

List all Objects within the Bucket:

```codeBlockLines_e6Vv
const { ok, value, error } = await client.list();
if (!ok) {
    // ... handle the error ...
}
console.log(value);
// > [{ name: 'file.txt' }]

```

### Delete an Object [​](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/\#delete-an-object "Direct link to Delete an Object")

Delete an Object from the Bucket:

```codeBlockLines_e6Vv
const { ok, error } = await client.delete("file.txt");
if (!ok) {
    // ... handle the error ...
}

```

- [Overview](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/#overview)
- [Installation](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/#installation)
  - [One-click Setup](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/#one-click-setup)
  - [Using npm](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/#using-npm)
  - [Using yarn](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/#using-yarn)
- [Quick Start](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/#quick-start)
  - [Setup a Client](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/#setup-a-client)
  - [Add an Object](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/#add-an-object)
  - [Get an Object](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/#get-an-object)
  - [List the Objects in the Bucket](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/#list-the-objects-in-the-bucket)
  - [Delete an Object](/cloud-services/storage-and-databases/object-storage/typescript-api-reference/#delete-an-object)