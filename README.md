# GymScore

GymScore is a standalone offline desktop application for managing gymnastics competitions.  IT
handles competitor registration, live score entry, and results.

## Download

Pre-built packages for Windows, Linux, and macOS are available on the
[Releases page](https://github.com/craigmiskell/gymscore/releases).

| Platform | File type                                              |
| -------- | ------------------------------------------------------ |
| Windows  | Portable `.exe` (no installation needed — just run it) |
| Linux    | `.deb` package (Debian/Ubuntu and derivatives)         |
| macOS    | `.zip` archive                                         |

### Windows

Download the `.exe` file and run it directly. No installation required.

### Linux

```shell
sudo dpkg -i gymscore_*.deb
```

### macOS

Unzip the downloaded archive and move `gymscore.app` to your Applications folder.

> **Note:** macOS packages are not currently code-signed. You may need to allow the app via
> System Settings → Privacy & Security after your first launch attempt.

## Usage

1. Launch GymScore.
1. Create a new competition and fill in the details (name, date, venue).
1. Add clubs and competitors, assigning to teams and groups.
1. Generate the programme and score recording sheets as PDFs for printing
1. At the competition, enter scores as they come in on recording sheets.
1. Once competition is over, generate results, placings, announcements, and certificates.

## For Developers

See [DEVELOPMENT.md](DEVELOPMENT.md) for setting up a development environment,
running the app locally, and cutting a release.

### Quick start

```shell
# Install dependencies (requires asdf — see DEVELOPMENT.md)
./scripts/setup-dev-env.sh
npm install

# Run with hot reload
npm run dev
```

### Tech stack

- [Electron](https://www.electronjs.org/) — cross-platform desktop shell
- [TypeScript](https://www.typescriptlang.org/) + [Webpack](https://webpack.js.org/) — build tooling
- [Bootstrap 5](https://getbootstrap.com/) — UI components
- [Dexie](https://dexie.org/) (IndexedDB) — local data storage
- [jsPDF](https://parall.ax/products/jspdf) — PDF generation

## LLMs

LLMs were used to create a pile of the code; basically most commits from 2026 onwards were, with commits before that
(2022) all hand-crafted.  You can probably guess how much faster I was with LLMs, and how it unblocked me.  I think this
is an acceptable trade-off for some of the downsides/concerns about LLMs that I and others have. No programmer was put
out of a job because no-one else was going to write this code with LLMs or otherwise, and I was able to spend only a
fraction of my vacation doing this, rather than frantically hand-crafting boilerplate PDF-generating code and so on.
The UI is better than I could have created by myself (I'm a sysadmin, not a UI designer) because the LLM could iterate
and let me experiment quickly, and do things I had no idea how to do before hand.  I kept a moderate hand on the code
quality, but no doubt there are things that someone more skilled in the art would look at and recoil from.  I don't care
much, because the proof is that it works, and does a thing, that wouldn've have been done otherwise.

I'm still a cynic, and there are other contexts I think it inappropriate or unhelpful, but here it was helpful.
I'm prepared to accept LLM generated PRs, although I will be reviewing them fairly closely.

## License

GymScore is free software: you can redistribute it and/or modify it under the terms of the
[GNU General Public License v3.0 or later](LICENSE).
