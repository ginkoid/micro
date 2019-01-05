# micro

Quick and easy file sharing with [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html).

## architechture

micro uploads files to a Backblaze B2 bucket in a flat directory structure, with files keyed by their md5 hash, encoded in base64.

Note that the base64 used here is not standard base64, but rather the alternate [base64url](https://tools.ietf.org/html/rfc4648#section-5).

## set up

To use micro, you'll need [a Backblaze account](https://www.backblaze.com/b2/sign-up.html), which has 10GB of storage for free.

* Create a bucket. Give it a name, and make it public.
* Upload a file to your bucket. The name and content does not matter.
* Click on your new file, and save the Friendly URL.
* Delete your file.
* Create an application key, and give it access only to the bucket you just created. It should have read and write access, and should be able to access files prefixed with `m/`.
* Copy your key value, key ID, bucket ID, bucket name, and public file origin (it should be the Friendly URL, but replace the file name with `m`) into a file in your home directory named `.micro-env`. A template is in `.micro-env.example`.
* Download the [latest release of micro for your OS](https://github.com/ginkoid/micro/releases), and run it.

## developing

The main upload script is `src/up.js`, which calls the Backblaze API through `src/req.js`.

The release binaries are made with [pkg](https://github.com/zeit/pkg).

Dependencies are managed with [yarn](https://yarnpkg.com).

## license

MIT © Philip Papurt
