# Bhaasa Linux downloads

[Download Bhaasa 0.7.1 for Linux x64](https://github.com/bhaashik/LanguageLearning/raw/refs/heads/linux-downloads/v0.7.1/Bhaasa-linux-x64.tar.gz) (about 42 MB)

This branch contains the portable Linux package. App source and setup guides are on the repository's [`main` branch](https://github.com/bhaashik/LanguageLearning/tree/main). Version 0.7.1 was built from source commit `f0c89919b6267ae61a2ea8155af91c8f48044248`.

Use a 64-bit Intel/AMD Linux computer with a modern browser installed. No separate Node.js installation is needed. Extract the archive and run:

```sh
tar -xzf Bhaasa-linux-x64.tar.gz
cd Bhaasa-linux-x64
./Bhaasa
```

The archive contains the executable, setup notes, and license notices. Settings, provider keys, progress, and personal recordings are not bundled. To verify the download, save [`SHA256SUMS`](v0.7.1/SHA256SUMS) beside the archive, then run `sha256sum -c SHA256SUMS`.

If GitHub shows a 404 or asks you to sign in, use an account with access to this repository. Download the file using the link above; GitHub's **Code → Download ZIP** downloads a branch snapshot instead of the portable app archive.
