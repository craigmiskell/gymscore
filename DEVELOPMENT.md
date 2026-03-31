# Development

## Environment setup

After checking out the repo:

1. Install [asdf](https://asdf-vm.com/guide/getting-started.html)
1. Install [gh](https://cli.github.com) (GitHub CLI) >= 2.x — no asdf plugin exists for it, so install
   via your system package manager or the instructions at that link
1. Run ./scripts/setup-dev-env.sh to install required plugins, versions, and OS packages
1. Install NPM modules:

   ```shell
   npm install
   ```

## Tasks

### Running in dev

With hot reload:

```shell
npm run dev
```

Clean build, no hot reload (not recommended, just kept for history)

```shell
npm start
```

See package.json for job/script definitions

### Style

To check style:

```shell
npm run eslint
```

To check and *fix* style automatically where possible:

```shell
npm run eslintfix
```

TODO: precommit with autofix

To check markdown style:

```shell
npm run mdlint
```

## Licenses

The app is licensed under GPLv3 or later, which may constrain which libraries can be used.  Verify that all
*production* modules are compatible with

```shell
npm exec license-check
```

The list of acceptable licenses is configured in the license-check script command in package.json.  If
non-listed licenses show up, license-check will fail; check the license and if it is compatible with GPLv3
(see the [license list](http://www.gnu.org/licenses/license-list.html) for guidance) then add it to the
list.  If it is not, find an alternative or rewrite as needed.

The license-check does not need to be performend on development-only modules because we are not further
distributing them, they are only pulled *by* the developer into their development environment, i.e. someone
else has distributed them to the developer and is responsible for ensuring the distribution is legal, and
they are then used locally for development purposes.

To update the list for display in the UI, run

```shell
npm exec generate-licenses
```

## Building the user guide

The user guide source lives in `docs/user-guide.md`. To generate it as HTML (for in-app display)
and PDF (for release artifacts), run:

```shell
npm run build-docs
```

This requires `pandoc` and `weasyprint`, both installed as OS packages by `setup-dev-env.sh`.
The generated `docs/user-guide.html` is also copied into `dist/renderer/` so the in-app Help
menu works. Run `npm run build` (webpack) first if `dist/renderer/` does not exist yet.

## Releasing a new version

Versioning follows [Conventional Commits](https://www.conventionalcommits.org/): commit messages prefixed with
`fix:` trigger a patch bump, `feat:` triggers a minor bump, and `BREAKING CHANGE:` in the footer triggers a
major bump.

When ready to cut a release, run:

```shell
npm run release
```

This will:

1. Determine the new version from commits since the last tag
2. Update `version` in `package.json`
3. Update `CHANGELOG.md`
4. Commit both files
5. Create a git tag (e.g. `v0.9.1`)
6. Push the commit and tag to GitHub

This triggers `scripts/publish-release.sh`, which builds packages for Linux, Windows, and macOS locally,
pushes the tag to GitHub, then creates a GitHub Release and attaches the built packages as artifacts.

The script uses the `gh` CLI for the GitHub release step. Run `gh auth login` once before your first
release to authenticate; subsequent releases use the stored token.

To override the version bump type (e.g. to force a minor or major bump regardless of commits):

```shell
npm run release:minor
npm run release:major
```

## Building for distribution

Run the make command for your choice of target OS.

```shell
npm run make-{linux,osx,windows}
```

The results will be a directory in `out/gymscore-<platform>-<arch>`; packing for distribution beyond that is
not yet tested or documented.

### Windows, from Linux

Electron-builder works without mono et al, and is far quicker than electron-forge which requires mono and ends up
rebuilding all manner of things.  It still takes a hot minute to sign with signtool, but I was unable to find the
incantation to disable that.

To build an ISO image to mount on a network-disconnected VM that one might be using to test:

```shell
version=$(jq -r .version package.json)
genisoimage -o out/iso/gymscore-${version}.iso "out/gymscore ${version}.exe"
```
