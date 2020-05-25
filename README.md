# EasyDl-cli

<img src="https://user-images.githubusercontent.com/7076809/82736366-a0525300-9d6c-11ea-9ec5-e22dda09131f.png" alt="Demo CLI" width="600"/>

A CLI wrapper for [EasyDl](https://github.com/andresusanto/easydl)

### Features

- Resumable download. Stop the download with `CTRL+C`, and resume it later by running the same `dl` command in the same directory.
- Faster download speed with parallel connections

### Installation

```
npm i -g easydl-cli
```

### Usage

```
  _____                ____  _
 | ____|__ _ ___ _   _|  _ \| |
 |  _| / _` / __| | | | | | | |
 | |__| (_| \__ \ |_| | |_| | |___
 |_____\__,_|___/\__, |____/|_____|
                 |___/
Usage: dl url [destination file/folder] [options]

Easily download files with built-in support for resume and parallel downloads.

Options:
  -V, --version               output the version number
  --chunk-size <number>       Chunk size in bytes
  -c, --connections <number>  Number of parallel connections
  -C, --clean [location]      Clean the given directory from chunk files. Defaults to active directory
  -h, --help                  display help for command
```
