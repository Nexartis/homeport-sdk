#!/usr/bin/env node
/* eslint-disable @typescript-eslint/ban-ts-comment -- generated twin carries an explained @ts-nocheck */
// @ts-nocheck — generated twin; owner bin/ozzydev-license-gate.mjs is the type-check surface
// GENERATED TWIN — do not edit. Owner: nexartis-ozzydev/bin/ozzydev-license-gate.mjs
// owner_version: 1.0.0 · owner_sha256: b438ec0adf3264d9a946606db2e0eb5f5c8a3c80456b01423bf231357fe550de
/**
 * License gate — proprietary/copyright conformance gate (Fleet Hardening v1).
 *
 * OWNER of the per-repo `scripts/license-gate.mjs` twin. The twin is written
 * ONLY by `bin/ozzydev-license-scaffold.mjs`, which stamps it with this file's
 * version + sha256. `--verify-twins` (owner-only) walks a workspace and compares
 * each twin's stamp to the current owner body sha, so a twin that has fallen
 * behind the owner is a loud DRIFT finding instead of silently running stale
 * gate logic.
 * This file is fully self-contained (node builtins only) so the twin runs in
 * any repo with zero cross-repo dependency.
 *
 * Checks, for a repo:
 *   1. `LICENSE` present and pointing at `LICENSES/`.
 *   2. `LICENSES/LicenseRef-Nexartis-Proprietary.txt` present.
 *   3. `NOTICE` present.
 *   4. `REUSE.toml` present (REUSE v3.3-compatible bulk declarations).
 *   5. `package.json` license field is the sanctioned non-SPDX form
 *      (`SEE LICENSE IN LICENSE`): the root manifest whenever it exists, and
 *      every tracked nested manifest that is publishable (`private !== true`).
 *      `private: true` nested packages are not distributed and are not checked.
 *   6. Every git-tracked file is licensed: it either carries a
 *      `SPDX-License-Identifier` in its first 6 lines, or its path matches a
 *      `REUSE.toml` annotation glob (bulk-declared class).
 *
 *   node bin/ozzydev-license-gate.mjs [--repo <path>] [--json] [--strict] [--help]
 *   node bin/ozzydev-license-gate.mjs --verify-twins [--workspace <path>] [--json]
 *
 * Exit: 0 clean · 1 findings (gate failure) · 2 usage · 3 classified
 * (repo_unreadable, git_unavailable, reuse_toml_malformed).
 * Loud classified output. No hidden behavior. REUSE-compatible by design:
 * when the artifacts exist and coverage is clean, `reuse lint` also passes.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'ozzydev-license-gate/v1';
export const VERSION = '1.0.0';
export const PROPRIETARY_REF = 'LicenseRef-Nexartis-Proprietary';
export const PROPRIETARY_TEXT_PATH = 'LICENSES/LicenseRef-Nexartis-Proprietary.txt';
export const NPM_LICENSE_FIELD = 'SEE LICENSE IN LICENSE';

function usageText() {
	// Twin body is copied verbatim. --help must name the file actually invoked:
	// owner bin/ozzydev-license-gate.mjs, generated twin scripts/license-gate.mjs.
	const base = process.argv[1] ? process.argv[1].split(/[/\\]/).pop() : '';
	const rel =
		base === 'ozzydev-license-gate.mjs'
			? 'bin/ozzydev-license-gate.mjs'
			: 'scripts/license-gate.mjs';
	return (
		`usage: node ${rel} [--repo <path>] [--json] [--strict] [--help]\n` +
		`       node ${rel} --verify-twins [--workspace <path>] [--json]`
	);
}

// --- tiny glob (REUSE.toml path patterns) --------------------------------
// Supports `**` (any depth), `*` (within segment), `?`. Anchored full match.
export function globToRegExp(pattern) {
	const esc = (s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
	let out = '';
	for (let i = 0; i < pattern.length; i++) {
		const c = pattern[i];
		if (c === '*') {
			if (pattern[i + 1] === '*') {
				// `**/` => optional any-depth prefix; `**` => any chars
				if (pattern[i + 2] === '/') {
					out += '(?:.*/)?';
					i += 2;
				} else {
					out += '.*';
					i += 1;
				}
			} else {
				out += '[^/]*';
			}
		} else if (c === '?') {
			out += '[^/]';
		} else {
			out += esc(c);
		}
	}
	return new RegExp(`^${out}$`);
}

/** Parse the REUSE.toml subset we emit: `[[annotations]]` blocks carrying a
 * `path` glob list plus the two SPDX keys. STRICT by design — a malformed
 * document is a classified `reuse_toml_malformed` (exit 3), never a silent
 * catch-all. The previous shape was a document-wide regex sweep for
 * `path = [...]`; it accepted `path = ["**"] <garbage>` as a valid declaration,
 * so one malformed line licensed every tracked file and the gate's advertised
 * REUSE-conformance guarantee was bypassable (augmentcode + codex threads on
 * the license wave, reproduced 2026-09-14: a well-formed control flags the
 * unlicensed file, the malformed document did not). */

// SPDX License List 3.29.0 — identifier facts only, pinned official data.
// Source: https://github.com/spdx/license-list-data/tree/31ba1a50e5397e00a304dbadc76531740e89ee48/json
// Both current and deprecated IDs are retained. Keep these sets embedded so the
// generated gate remains self-contained in consumer repos (no npm dependency).
const SPDX_LICENSE_IDS = new Set(
	`
0BSD 3D-Slicer-1.0 AAL ADSL AFL-1.1 AFL-1.2 AFL-2.0 AFL-2.1 AFL-3.0 AGPL-1.0 AGPL-1.0-only
AGPL-1.0-or-later AGPL-3.0 AGPL-3.0-only AGPL-3.0-or-later ALGLIB-Documentation AMD-newlib AMDPLPA
AML AML-glslang AMPAS ANTLR-PD ANTLR-PD-fallback APAFML APL-1.0 APSL-1.0 APSL-1.1 APSL-1.2 APSL-2.0
ASWF-Digital-Assets-1.0 ASWF-Digital-Assets-1.1 Abstyles AdaCore-doc Adobe-2006
Adobe-Display-PostScript Adobe-Glyph Adobe-Utopia Advanced-Cryptics-Dictionary Afmparse Aladdin
Apache-1.0 Apache-1.1 Apache-2.0 App-s2p Arphic-1999 Artistic-1.0 Artistic-1.0-Perl Artistic-1.0-cl8
Artistic-2.0 Artistic-dist Aspell-RU BOLA-1.1 BSD-1-Clause BSD-2-Clause BSD-2-Clause-Darwin
BSD-2-Clause-FreeBSD BSD-2-Clause-NetBSD BSD-2-Clause-Patent BSD-2-Clause-Views
BSD-2-Clause-first-lines BSD-2-Clause-pkgconf-disclaimer BSD-2-Clause-pos-unchanged BSD-3-Clause
BSD-3-Clause-Attribution BSD-3-Clause-Clear BSD-3-Clause-HP BSD-3-Clause-LBNL
BSD-3-Clause-Modification BSD-3-Clause-No-Military-License BSD-3-Clause-No-Nuclear-License
BSD-3-Clause-No-Nuclear-License-2014 BSD-3-Clause-No-Nuclear-Warranty BSD-3-Clause-Open-MPI
BSD-3-Clause-OpenWebUI BSD-3-Clause-Sun BSD-3-Clause-Tso BSD-3-Clause-acpica BSD-3-Clause-flex
BSD-4-Clause BSD-4-Clause-Shortened BSD-4-Clause-UC BSD-4.3RENO BSD-4.3TAHOE
BSD-Advertising-Acknowledgement BSD-Attribution-HPND-disclaimer BSD-Inferno-Nettverk
BSD-Mark-Modifications BSD-Protection BSD-Source-Code BSD-Source-Code-no-disclaimer
BSD-Source-alt-GPL BSD-Source-beginning-file BSD-Systemics BSD-Systemics-W3Works BSD-ask-to-endorse
BSL-1.0 BUSL-1.1 Baekmuk Bahyph Barr Beerware BitTorrent-1.0 BitTorrent-1.1 Bitstream-Charter
Bitstream-Vera BlueOak-1.0.0 Boehm-GC Boehm-GC-without-fee Borceux Brian-Gladman-2-Clause
Brian-Gladman-3-Clause Brian-Gladman-3-Clause-no-conversion Buddy Bugroff C-UDA-1.0 CAL-1.0
CAL-1.0-Combined-Work-Exception CAPEC-tou CATOSL-1.1 CC-BY-1.0 CC-BY-2.0 CC-BY-2.5 CC-BY-2.5-AU
CC-BY-3.0 CC-BY-3.0-AT CC-BY-3.0-AU CC-BY-3.0-DE CC-BY-3.0-IGO CC-BY-3.0-NL CC-BY-3.0-US CC-BY-4.0
CC-BY-NC-1.0 CC-BY-NC-2.0 CC-BY-NC-2.5 CC-BY-NC-3.0 CC-BY-NC-3.0-DE CC-BY-NC-3.0-IGO CC-BY-NC-4.0
CC-BY-NC-ND-1.0 CC-BY-NC-ND-2.0 CC-BY-NC-ND-2.5 CC-BY-NC-ND-3.0 CC-BY-NC-ND-3.0-DE
CC-BY-NC-ND-3.0-IGO CC-BY-NC-ND-4.0 CC-BY-NC-SA-1.0 CC-BY-NC-SA-2.0 CC-BY-NC-SA-2.0-DE
CC-BY-NC-SA-2.0-FR CC-BY-NC-SA-2.0-UK CC-BY-NC-SA-2.5 CC-BY-NC-SA-3.0 CC-BY-NC-SA-3.0-DE
CC-BY-NC-SA-3.0-IGO CC-BY-NC-SA-4.0 CC-BY-ND-1.0 CC-BY-ND-2.0 CC-BY-ND-2.5 CC-BY-ND-3.0
CC-BY-ND-3.0-DE CC-BY-ND-4.0 CC-BY-SA-1.0 CC-BY-SA-2.0 CC-BY-SA-2.0-UK CC-BY-SA-2.1-JP CC-BY-SA-2.5
CC-BY-SA-3.0 CC-BY-SA-3.0-AT CC-BY-SA-3.0-DE CC-BY-SA-3.0-IGO CC-BY-SA-4.0 CC-PDDC CC-PDM-1.0
CC-SA-1.0 CC0-1.0 CDDL-1.0 CDDL-1.1 CDL-1.0 CDLA-Permissive-1.0 CDLA-Permissive-2.0 CDLA-Sharing-1.0
CECILL-1.0 CECILL-1.1 CECILL-2.0 CECILL-2.1 CECILL-B CECILL-C CERN-OHL-1.1 CERN-OHL-1.2
CERN-OHL-P-2.0 CERN-OHL-S-2.0 CERN-OHL-W-2.0 CFITSIO CMU-Mach CMU-Mach-nodoc CNRI-Jython CNRI-Python
CNRI-Python-GPL-Compatible COIL-1.0 CPAL-1.0 CPL-1.0 CPOL-1.02 CUA-OPL-1.0 Caldera
Caldera-no-preamble Catharon ClArtistic Clips Community-Spec-1.0 Condor-1.1 Cornell-Lossless-JPEG
Cronyx Crossword CryptoSwift CrystalStacker Cube D-FSL-1.0 DEC-3-Clause DL-DE-BY-2.0 DL-DE-ZERO-2.0
DOC DRL-1.0 DRL-1.1 DSDP DocBook-DTD DocBook-Schema DocBook-Stylesheet DocBook-XML Dotseqn ECL-1.0
ECL-2.0 EFL-1.0 EFL-2.0 EPICS EPL-1.0 EPL-2.0 ESA-PL-permissive-2.4 ESA-PL-strong-copyleft-2.4
ESA-PL-weak-copyleft-2.4 EUDatagrid EUPL-1.0 EUPL-1.1 EUPL-1.2 Elastic-2.0 Entessa ErlPL-1.1 Eurosym
FBM FDK-AAC FDK-MPEG-H FSFAP FSFAP-no-warranty-disclaimer FSFUL FSFULLR FSFULLRSD FSFULLRWD
FSL-1.1-ALv2 FSL-1.1-MIT FTL Fair Ferguson-Twofish Frameworx-1.0 FreeBSD-DOC FreeImage Furuseth
GCR-docs GD GFDL-1.1 GFDL-1.1-invariants-only GFDL-1.1-invariants-or-later
GFDL-1.1-no-invariants-only GFDL-1.1-no-invariants-or-later GFDL-1.1-only GFDL-1.1-or-later GFDL-1.2
GFDL-1.2-invariants-only GFDL-1.2-invariants-or-later GFDL-1.2-no-invariants-only
GFDL-1.2-no-invariants-or-later GFDL-1.2-only GFDL-1.2-or-later GFDL-1.3 GFDL-1.3-invariants-only
GFDL-1.3-invariants-or-later GFDL-1.3-no-invariants-only GFDL-1.3-no-invariants-or-later
GFDL-1.3-only GFDL-1.3-or-later GL2PS GLWTPL GPL-1.0 GPL-1.0+ GPL-1.0-only GPL-1.0-or-later GPL-2.0
GPL-2.0+ GPL-2.0-only GPL-2.0-or-later GPL-2.0-with-GCC-exception GPL-2.0-with-autoconf-exception
GPL-2.0-with-bison-exception GPL-2.0-with-classpath-exception GPL-2.0-with-font-exception GPL-3.0
GPL-3.0+ GPL-3.0-only GPL-3.0-or-later GPL-3.0-with-GCC-exception GPL-3.0-with-autoconf-exception
Game-Programming-Gems Giftware Glide Glulxe Graphics-Gems Gutmann HDF5 HIDAPI HP-1986 HP-1989 HPND
HPND-DEC HPND-Fenneberg-Livingston HPND-INRIA-IMAG HPND-Intel HPND-Kevlin-Henney HPND-MIT-disclaimer
HPND-Markus-Kuhn HPND-Netrek HPND-Pbmplus HPND-SMC HPND-UC HPND-UC-export-US HPND-doc HPND-doc-sell
HPND-export-US HPND-export-US-acknowledgement HPND-export-US-modify HPND-export2-US
HPND-merchantability-variant HPND-sell-MIT-disclaimer-xserver HPND-sell-regexpr HPND-sell-variant
HPND-sell-variant-MIT-disclaimer HPND-sell-variant-MIT-disclaimer-rev
HPND-sell-variant-critical-systems HTMLTIDY HaskellReport Hippocratic-2.1 Hippocratic-3.0-core
IBM-pibs ICU IEC-Code-Components-EULA IJG IJG-short IPA IPL-1.0 ISC ISC-Veillard ISO-permission
ImageMagick Imlib2 Info-ZIP Informatica Inner-Net-2.0 InnoSetup Intel Intel-ACPI Interbase-1.0
JPL-image JPNIC JSON Jam JasPer-2.0 Kastrup Kazlib Knuth-CTAN LAL-1.2 LAL-1.3 LGPL-2.0 LGPL-2.0+
LGPL-2.0-only LGPL-2.0-or-later LGPL-2.1 LGPL-2.1+ LGPL-2.1-only LGPL-2.1-or-later LGPL-3.0
LGPL-3.0+ LGPL-3.0-only LGPL-3.0-or-later LGPLLR LOOP LPD-document LPL-1.0 LPL-1.02 LPPL-1.0
LPPL-1.1 LPPL-1.2 LPPL-1.3a LPPL-1.3c LZMA-SDK-9.11-to-9.20 LZMA-SDK-9.22 Latex2e
Latex2e-translated-notice Leptonica LiLiQ-P-1.1 LiLiQ-R-1.1 LiLiQ-Rplus-1.1 Libpng Linux-OpenIB
Linux-man-pages-1-para Linux-man-pages-copyleft Linux-man-pages-copyleft-2-para
Linux-man-pages-copyleft-var Lucida-Bitmap-Fonts MIPS MIT MIT-0 MIT-CMU MIT-Click MIT-Festival
MIT-Khronos-old MIT-Modern-Variant MIT-STK MIT-Wu MIT-advertising MIT-enna MIT-feh MIT-open-group
MIT-testregex MITNFA MMIXware MMPL-1.0.1 MPEG-SSG MPL-1.0 MPL-1.1 MPL-2.0
MPL-2.0-no-copyleft-exception MS-LPL MS-PL MS-RL MTLL MVT-1.1 Mackerras-3-Clause
Mackerras-3-Clause-acknowledgment MakeIndex Martin-Birgmeier McPhee-slideshow Minpack MirOS Motosoto
MulanPSL-1.0 MulanPSL-2.0 Multics Mup NAIST-2003 NASA-1.3 NBPL-1.0 NCBI-PD NCGL-UK-2.0 NCL NCSA NGPL
NICTA-1.0 NIST-PD NIST-PD-TNT NIST-PD-fallback NIST-Software NLOD-1.0 NLOD-2.0 NLPL NOSL NPL-1.0
NPL-1.1 NPOSL-3.0 NRL NTIA-PD NTP NTP-0 Naumen Net-SNMP NetCDF Newsletr Nokia Noweb Nunit O-UDA-1.0
OAR OCCT-PL OCLC-2.0 ODC-By-1.0 ODbL-1.0 OFFIS OFL-1.0 OFL-1.0-RFN OFL-1.0-no-RFN OFL-1.1
OFL-1.1-RFN OFL-1.1-no-RFN OGC-1.0 OGDL-Taiwan-1.0 OGL-Canada-2.0 OGL-UK-1.0 OGL-UK-2.0 OGL-UK-3.0
OGTSL OLDAP-1.1 OLDAP-1.2 OLDAP-1.3 OLDAP-1.4 OLDAP-2.0 OLDAP-2.0.1 OLDAP-2.1 OLDAP-2.2 OLDAP-2.2.1
OLDAP-2.2.2 OLDAP-2.3 OLDAP-2.4 OLDAP-2.5 OLDAP-2.6 OLDAP-2.7 OLDAP-2.8 OLFL-1.3 OML OPL-1.0
OPL-UK-3.0 OPUBL-1.0 OSC-1.0 OSET-PL-2.1 OSL-1.0 OSL-1.1 OSL-2.0 OSL-2.1 OSL-3.0 OSSP OpenMDW-1.0
OpenPBS-2.3 OpenSSL OpenSSL-standalone OpenVision PADL PDDL-1.0 PHP-3.0 PHP-3.01 PPL PSF-2.0
ParaType-Free-Font-1.3 Parity-6.0.0 Parity-7.0.0 Pixar Plexus PolyForm-Noncommercial-1.0.0
PolyForm-Small-Business-1.0.0 PostgreSQL Python-2.0 Python-2.0.1 QPL-1.0 QPL-1.0-INRIA-2004 Qhull
RHeCos-1.1 RPL-1.1 RPL-1.5 RPSL-1.0 RSA-MD RSCPL Rdisc Ruby Ruby-pty SAX-PD SAX-PD-2.0 SCEA
SGI-B-1.0 SGI-B-1.1 SGI-B-2.0 SGI-OpenGL SGMLUG-PM SGP4 SHL-0.5 SHL-0.51 SISSL SISSL-1.2 SL
SMAIL-GPL SMLNJ SMPPL SNIA SOFA SPL-1.0 SSH-OpenSSH SSH-short SSLeay-standalone SSPL-1.0 SUL-1.0 SWL
Saxpath SchemeReport Sendmail Sendmail-8.23 Sendmail-Open-Source-1.1 SimPL-2.0 Sleepycat Soundex
Spencer-86 Spencer-94 Spencer-99 StandardML-NJ SugarCRM-1.1.3 Sun-PPP Sun-PPP-2000 SunPro Symlinks
TAPR-OHL-1.0 TCL TCP-wrappers TGPPL-1.0 TMate TORQUE-1.1 TOSL TPDL TPL-1.0 TTWL TTYP0 TU-Berlin-1.0
TU-Berlin-2.0 TekHVC TermReadKey ThirdEye TrustedQSL UCAR UCL-1.0 UMich-Merit UPL-1.0 URT-RLE
Ubuntu-font-1.0 UnRAR Unicode-3.0 Unicode-DFS-2015 Unicode-DFS-2016 Unicode-TOU UnixCrypt Unlicense
Unlicense-libtelnet Unlicense-libwhirlpool VOSTROM VSL-1.0 Vim Vixie-Cron W3C W3C-19980720
W3C-20150513 WTFNMFPL WTFPL Watcom-1.0 Widget-Workshop WordNet Wsuipa X11
X11-distribute-modifications-variant X11-no-permit-persons X11-swapped XFree86-1.1 XSkat Xdebug-1.03
Xerox Xfig Xnet YPL-1.0 YPL-1.1 ZPL-1.1 ZPL-2.0 ZPL-2.1 Zed Zeeff Zend-2.0 Zimbra-1.3 Zimbra-1.4
Zlib any-OSI any-OSI-perl-modules atc-game bcrypt-Solar-Designer blessing bzip2-1.0.5 bzip2-1.0.6
check-cvs checkmk copyleft-next-0.3.0 copyleft-next-0.3.1 curl cve-tou diffmark dtoa dvipdfm
eCos-2.0 eGenix etalab-2.0 fwlw gSOAP-1.3b generic-xts gnuplot gtkbook hdparm hyphen-bulgarian
iMatix jove libpng-1.6.35 libpng-2.0 libselinux-1.0 libtiff libutil-David-Nugent lsof magaz mailprio
man2html metamail mpi-permissive mpich2 mplus ngrep pkgconf pnmstitch psfrag psutils python-ldap
radvd snprintf softSurfer ssh-keyscan swrule threeparttable ulem w3m wwl wxWindows xinetd
xkeyboard-config-Zinoviev xlock xpp xzoom zlib-acknowledgement
`
		.trim()
		.toLowerCase()
		.split(/\s+/)
);

const SPDX_EXCEPTION_IDS = new Set(
	`
389-exception Asterisk-exception Asterisk-linking-protocols-exception Autoconf-exception-2.0
Autoconf-exception-3.0 Autoconf-exception-generic Autoconf-exception-generic-3.0
Autoconf-exception-macro Bison-exception-1.24 Bison-exception-2.2 Bootloader-exception
CGAL-linking-exception CLISP-exception-2.0 Classpath-exception-2.0 Classpath-exception-2.0-short
DigiRule-FOSS-exception Digia-Qt-LGPL-exception-1.1 FLTK-exception Fawkes-Runtime-exception
Font-exception-2.0 GCC-exception-2.0 GCC-exception-2.0-note GCC-exception-3.1 GNAT-exception
GNOME-examples-exception GNU-compiler-exception GPL-3.0-389-ds-base-exception
GPL-3.0-interface-exception GPL-3.0-linking-exception GPL-3.0-linking-source-exception GPL-CC-1.0
GStreamer-exception-2005 GStreamer-exception-2008 Gmsh-exception Google-Patent-WebM
Independent-modules-exception KiCad-libraries-exception LGPL-3.0-linking-exception LLGPL
LLVM-exception LZMA-exception Libtool-exception Linux-syscall-note Nokia-Qt-exception-1.1
OCCT-exception-1.0 OCaml-LGPL-linking-exception OpenJDK-assembly-exception-1.0 PCRE2-exception
PS-or-PDF-font-exception-20170817 QPL-1.0-INRIA-2004-exception Qt-GPL-exception-1.0
Qt-LGPL-exception-1.1 Qwt-exception-1.0 RRDtool-FLOSS-exception-2.0 SANE-exception SHL-2.0 SHL-2.1
SWI-exception Simple-Library-Usage-exception Spelling-Provider-LGPL-exception Swift-exception
Texinfo-exception UBDL-exception Universal-FOSS-exception-1.0 WxWindows-exception-3.1
cryptsetup-OpenSSL-exception eCos-exception-2.0 erlang-otp-linking-exception fmt-exception
freertos-exception-2.0 gnu-javamail-exception harbour-exception i2p-gpl-java-exception
kvirc-openssl-exception libpri-OpenH323-exception mif-exception mxml-exception
openvpn-openssl-exception polyparse-exception romic-exception rsync-linking-exception
sqlitestudio-OpenSSL-exception stunnel-exception u-boot-exception-2.0 vsftpd-openssl-exception
x11vnc-openssl-exception
`
		.trim()
		.toLowerCase()
		.split(/\s+/)
);

/** SPDX License Expression (Annex D), not a letter-presence check.
 * Listed IDs are case-insensitive; operators remain case-sensitive. Custom
 * licenses use LicenseRef-… . NONE/NOASSERTION are SPDX document field values,
 * not license expressions that can grant source-file coverage (REUSE 3.3).
 */
export function isSpdxExpression(raw) {
	const input = String(raw ?? '').trim();
	if (!input) return false;
	const tokens = [];
	let i = 0;
	while (i < input.length) {
		const c = input[i];
		if (c === ' ' || c === '\t') {
			i++;
			continue;
		}
		if (c === '(' || c === ')' || c === '+') {
			tokens.push({ value: c, start: i, end: i + 1 });
			i++;
			continue;
		}
		const m = /^[A-Za-z0-9.-]+(?::[A-Za-z0-9.-]+)?/.exec(input.slice(i));
		if (!m) return false;
		tokens.push({ value: m[0], start: i, end: i + m[0].length });
		i += m[0].length;
	}
	if (tokens.length === 0) return false;
	let p = 0;
	const peek = () => tokens[p]?.value;
	const isLicenseRef = (tok) =>
		/^(?:DocumentRef-[A-Za-z0-9.-]+:)?LicenseRef-[A-Za-z0-9.-]+$/.test(tok ?? '');
	const isLicenseId = (tok) => SPDX_LICENSE_IDS.has(String(tok ?? '').toLowerCase());
	const hasBooleanBoundaries = () => {
		const previous = tokens[p - 1];
		const operator = tokens[p];
		const next = tokens[p + 1];
		// SPDX 2.3 permits whitespace OR parentheses beside AND/OR. A +
		// suffix alone is not a separator: GPL-2.0+OR MIT must be refused.
		return (
			previous &&
			next &&
			(operator.start > previous.end || previous.value === ')') &&
			(next.start > operator.end || next.value === '(')
		);
	};
	const parseOr = () => {
		if (!parseAnd()) return false;
		while (peek() === 'OR') {
			if (!hasBooleanBoundaries()) return false;
			p++;
			if (!parseAnd()) return false;
		}
		return true;
	};
	const parseAnd = () => {
		if (!parseWith()) return false;
		while (peek() === 'AND') {
			if (!hasBooleanBoundaries()) return false;
			p++;
			if (!parseWith()) return false;
		}
		return true;
	};
	const parseWith = () => {
		const simple = peek() !== '(';
		if (!parsePrimary()) return false;
		if (peek() === 'WITH') {
			// Annex D permits WITH only after a simple license expression and
			// requires whitespace on both sides, plus a listed exception ID.
			if (
				!simple ||
				tokens[p].start === tokens[p - 1].end ||
				!tokens[p + 1] ||
				tokens[p].end === tokens[p + 1].start
			)
				return false;
			p++;
			if (!SPDX_EXCEPTION_IDS.has(String(peek() ?? '').toLowerCase())) return false;
			p++;
		}
		return true;
	};
	const parsePrimary = () => {
		if (peek() === '(') {
			p++;
			if (!parseOr()) return false;
			if (peek() !== ')') return false;
			p++;
			return true;
		}
		const listed = isLicenseId(peek());
		if (!listed && !isLicenseRef(peek())) return false;
		p++;
		if (peek() === '+') {
			// Only a listed license can carry +, directly adjacent to its ID.
			if (!listed || tokens[p].start !== tokens[p - 1].end) return false;
			p++;
		}
		return true;
	};
	return parseOr() && p === tokens.length;
}

export function parseReuseToml(text) {
	const fail = (reason, lineNo) => {
		const e = new Error(`${reason}${lineNo > 0 ? ` (line ${lineNo})` : ''}`);
		e.code = 'reuse_toml_malformed';
		throw e;
	};
	const unquote = (s, lineNo) => {
		const t = String(s).trim();
		if (/^"(?:[^"\\]|\\.)*"$/.test(t)) {
			return t.slice(1, -1).replace(/\\(["\\])/g, '$1');
		}
		// TOML 1.0 literal strings: single-quoted, no escape processing.
		if (/^'[^']*'$/.test(t)) {
			return t.slice(1, -1);
		}
		fail(`expected a quoted string, got ${JSON.stringify(t)}`, lineNo);
	};
	/** Split a TOML array body on commas OUTSIDE quoted strings. */
	const splitArray = (inner, lineNo) => {
		const out = [];
		let buf = '';
		let inStr = null;
		for (let i = 0; i < inner.length; i++) {
			const c = inner[i];
			if (inStr) {
				if (inStr === '"' && c === '\\') {
					buf += c + (inner[++i] ?? '');
					continue;
				}
				if (c === inStr) inStr = null;
				buf += c;
				continue;
			}
			// TOML 1.0 literal strings use single quotes; track the opening
			// quote so a comma inside either string form is not a separator.
			if (c === '"' || c === "'") {
				inStr = c;
				buf += c;
				continue;
			}
			if (c === ',') {
				out.push(buf);
				buf = '';
				continue;
			}
			buf += c;
		}
		if (inStr) fail('unterminated string in array', lineNo);
		out.push(buf);
		const raw = out.map((s) => s.trim());
		// TOML forbids interior empty elements; only a single trailing comma
		// (one trailing empty) is legal. Silently filtering would let
		// `path = ["**",,]` drop a malformed element instead of refusing.
		for (let i = 0; i < raw.length - 1; i++) {
			if (raw[i] === '') {
				fail('empty element in array (interior empty elements are not valid TOML)', lineNo);
			}
		}
		return raw.filter(Boolean).map((s) => unquote(s, lineNo));
	};

	const lines = String(text).split(/\r?\n/);
	const blocks = [];
	const topLevelKeys = new Set();
	let block = null;
	let arrayKey = null;
	let arrayBuf = [];

	const assign = (key, values, lineNo) => {
		if (!block) fail(`"${key}" appears outside an [[annotations]] block`, lineNo);
		if (key === 'path') {
			if (block.paths) fail('duplicate path key in one [[annotations]] block', lineNo);
			block.paths = values;
		}
	};
	// REUSE v3.3 permits both SPDX fields as either a quoted scalar or a list of
	// strings; either form is a declaration. `declare` is the single place that
	// turns a value (scalar or list) into a licensing declaration.
	const isSpdxKey = (key) => key === 'SPDX-FileCopyrightText' || key === 'SPDX-License-Identifier';
	const declare = (key, value) => {
		const parts = (Array.isArray(value) ? value : [value])
			.map((v) => String(v).trim())
			.filter(Boolean);
		if (parts.length === 0) return;
		if (key === 'SPDX-FileCopyrightText') {
			block.hasCopyright = true;
			block.spdxCopyright = parts.join('\n');
		} else if (key === 'SPDX-License-Identifier') {
			for (const v of parts) {
				if (!isSpdxExpression(v)) {
					fail(`SPDX-License-Identifier is not a valid SPDX expression: ${JSON.stringify(v)}`, 0);
				}
			}
			block.hasLicense = true;
			block.spdxLicense = parts.join(' AND ');
		}
	};
	const closeBlock = () => {
		if (!block.paths || block.paths.length === 0) {
			fail('[[annotations]] block declares no path', 0);
		}
		// A declaration that carries only globs and no licensing field licenses
		// nothing — treat it as malformed rather than as a catch-all. The legacy
		// implicit shape (a bare top-level `path = ...`) gets no exemption: it
		// granted glob coverage of the whole repo with no licensing declaration
		// (review P1 on the-ocme-ric-gateway-sdk#142).
		if (!block.hasCopyright && !block.hasLicense) {
			fail('[[annotations]] block carries no SPDX-FileCopyrightText or SPDX-License-Identifier', 0);
		}
		// Copyright-only is legal REUSE (copyright may aggregate under the
		// default precedence "closest") but it is not a license. Its globs
		// must not count as SPDX coverage.
		if (block.hasLicense) blocks.push({ paths: block.paths });
		block = null;
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		const lineNo = i + 1;
		if (!line || line.startsWith('#')) continue;

		if (arrayKey) {
			arrayBuf.push(line);
			const joined = arrayBuf.join(' ');
			const open = joined.indexOf('[');
			const close = joined.indexOf(']', open + 1);
			if (close === -1) continue;
			// TOML 1.0 permits an end-of-line comment after the array close.
			const rest = joined
				.slice(close + 1)
				.replace(/#.*$/, '')
				.trim();
			if (rest) fail(`unexpected content after array close: ${rest}`, lineNo);
			const values = splitArray(joined.slice(open + 1, close), lineNo);
			if (isSpdxKey(arrayKey)) declare(arrayKey, values);
			else assign(arrayKey, values, lineNo);
			arrayKey = null;
			arrayBuf = [];
			continue;
		}

		// TOML allows a trailing comment after a table header, e.g.
		// `[[annotations]] # generated assets`. Accept it; an unrelated header
		// (`[[other]]`) still fails loud below.
		if (/^\[\[annotations\]\](\s*#.*)?$/.test(line)) {
			if (block) closeBlock();
			block = { paths: null, hasCopyright: false, hasLicense: false, keys: new Set() };
			continue;
		}
		if (line.startsWith('[')) fail(`unsupported TOML table header: ${line}`, lineNo);

		const kv = /^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/.exec(line);
		if (!kv) fail(`not a TOML key/value line: ${line}`, lineNo);
		const key = kv[1];
		const value = kv[2].trim();
		if (!block) {
			// The scaffolder always emits an explicit `[[annotations]]` header.
			// A bare top-level `path = ...` is accepted as an implicit block for
			// the legacy document shape the parser tests pin — strictly parsed,
			// still never a licence declaration. Any other stray top-level key
			// is invalid REUSE and fails loud (NO HIDDEN BEHAVIOR).
			if (key === 'path') {
				block = {
					paths: null,
					hasCopyright: false,
					hasLicense: false,
					implicit: true,
					keys: topLevelKeys
				};
			} else if (key === 'version' || key === 'precedence') {
				if (topLevelKeys.has(key)) fail(`duplicate ${key} key in top-level table`, lineNo);
				topLevelKeys.add(key);
				if (!/^("[^"]*"|'[^']*'|-?\d+|true|false)$/.test(value)) {
					fail(`invalid TOML scalar for "${key}": ${value}`, lineNo);
				}
				// Only the supported REUSE.toml schema version is a valid
				// declaration; a stray `version = 2` (or a quoted/boolean
				// value) must not read as a version-1 document.
				if (key === 'version' && value !== '1') {
					fail(`unsupported REUSE.toml version: ${value} (expected 1)`, lineNo);
				}
				continue;
			} else {
				fail(`"${key}" appears outside an [[annotations]] block`, lineNo);
			}
		}

		// TOML key uniqueness is scoped to a table, regardless of scalar/list
		// form or an empty declaration. Reserve multiline keys at their opener.
		if (block.keys.has(key)) fail(`duplicate ${key} key in one [[annotations]] block`, lineNo);
		block.keys.add(key);

		if (value.startsWith('[')) {
			if (key === 'precedence') fail('precedence must be a string, not an array', lineNo);
			const close = value.indexOf(']', 1);
			if (close === -1) {
				arrayKey = key;
				arrayBuf = [value];
				continue;
			}
			// TOML 1.0 permits an end-of-line comment after the array close.
			const rest = value
				.slice(close + 1)
				.replace(/#.*$/, '')
				.trim();
			if (rest) fail(`unexpected content after array: ${rest}`, lineNo);
			const values = splitArray(value.slice(1, close), lineNo);
			if (isSpdxKey(key)) declare(key, values);
			else assign(key, values, lineNo);
			continue;
		}
		if (key === 'path') {
			assign(key, [unquote(value, lineNo)], lineNo);
			continue;
		}
		const scalar = unquote(value, lineNo);
		// REUSE 3.3: precedence is OPTIONAL (default "closest"; schema
		// required=["path"]). A present value must be the enum. Requiring the
		// key would false-fail every phase-1 REUSE.toml this scaffolder emits.
		if (key === 'precedence') {
			if (!['closest', 'aggregate', 'override'].includes(scalar)) {
				fail(`precedence must be "closest", "aggregate", or "override"`, lineNo);
			}
			block.precedence = scalar;
			continue;
		}
		// An empty or whitespace-only value is not a licensing declaration: a
		// block whose only "licence" is spaces must fail closeBlock, never
		// license its globs. (Whitespace `SPDX-License-Identifier` and empty
		// `SPDX-FileCopyrightText` both passed before 2026-09-14.)
		declare(key, scalar);
	}
	if (arrayKey) fail(`array for "${arrayKey}" was never closed`, lines.length);
	if (block) closeBlock();
	return blocks;
}

function hasSpdxHeader(absPath) {
	try {
		const lines = readFileSync(absPath, 'utf8').split(/\r?\n/, 6);
		for (const line of lines) {
			const m = /SPDX-License-Identifier\s*:\s*(\S.*?)\s*$/.exec(line);
			if (!m) continue;
			// The value must be a real identifier ON THE SAME LINE. The old
			// full-head regex let `\s*` cross newlines, so a blank
			// `// SPDX-License-Identifier:` borrowed the first token from the
			// next line (`const`, `//`, …) and counted the file as licensed.
			// The trailing comment-close stripper must accept the HTML spec's
			// `--!>` end and not only `-->` (CodeQL js/bad-html-filtering-regexp).
			const value = m[1].replace(/\s*(?:\*\/|--!?>)\s*$/, '').trim();
			if (isSpdxExpression(value)) return true;
		}
		return false;
	} catch {
		return false;
	}
}

function gitTracked(repo) {
	try {
		const out = execFileSync('git', ['-C', repo, 'ls-files', '-z'], {
			encoding: 'utf8',
			maxBuffer: 32 * 1024 * 1024
		});
		return out.split('\0').filter(Boolean);
	} catch (err) {
		const e = new Error(`git ls-files failed in ${repo}: ${err.message}`);
		e.code = 'git_unavailable';
		throw e;
	}
}

export function runGate(repo = process.cwd()) {
	const root = resolve(repo);
	if (!existsSync(root)) {
		const e = new Error(`repo_unreadable: ${root}`);
		e.code = 'repo_unreadable';
		throw e;
	}
	const findings = [];
	const lic = join(root, 'LICENSE');
	if (!existsSync(lic)) {
		findings.push({ class: 'license_missing', detail: 'LICENSE not found at repo root' });
	} else {
		const body = readFileSync(lic, 'utf8');
		const covered = /LICENSES\//.test(body) || /LicenseRef-Nexartis-Proprietary/.test(body);
		if (!covered) {
			findings.push({
				class: 'license_pointer_missing',
				detail: 'LICENSE does not point at LICENSES/ or the Nexartis proprietary ref'
			});
		}
	}
	for (const [p, cls] of [
		[PROPRIETARY_TEXT_PATH, 'license_text_missing'],
		['NOTICE', 'notice_missing'],
		['REUSE.toml', 'reuse_toml_missing']
	]) {
		if (!existsSync(join(root, p))) findings.push({ class: cls, detail: `${p} not found` });
	}

	// package.json license field
	const pkgPath = join(root, 'package.json');
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
			if (pkg.license !== NPM_LICENSE_FIELD) {
				findings.push({
					class: 'package_license_field',
					detail: `package.json license=${JSON.stringify(pkg.license ?? null)} (expected "${NPM_LICENSE_FIELD}")`
				});
			}
		} catch {
			findings.push({ class: 'package_json_unreadable', detail: 'package.json is not valid JSON' });
		}
	}

	// Coverage: header OR REUSE.toml annotation glob
	let annotations = [];
	const reusePath = join(root, 'REUSE.toml');
	if (existsSync(reusePath)) {
		try {
			annotations = parseReuseToml(readFileSync(reusePath, 'utf8'));
		} catch (err) {
			if (err && err.code === 'reuse_toml_malformed') throw err;
			const e = new Error(`reuse_toml_malformed: ${err.message}`);
			e.code = 'reuse_toml_malformed';
			throw e;
		}
	}
	const globs = annotations.flatMap((a) => a.paths.map((p) => globToRegExp(p)));
	const tracked = gitTracked(root);
	// Publishable package manifests beyond the root carry distribution terms
	// too: a workspace package that could be published under `"license": "MIT"`
	// is a licensing gap the root-only check missed (2026-09-14 review). The
	// root manifest is checked above regardless of `private`; nested manifests
	// are checked only when they are publishable (`private: true` is not
	// distributed).
	for (const rel of tracked) {
		if (rel === 'package.json' || !rel.endsWith('/package.json')) continue;
		let pkg;
		try {
			pkg = JSON.parse(readFileSync(join(root, rel), 'utf8'));
		} catch {
			findings.push({ class: 'package_json_unreadable', detail: `${rel} is not valid JSON` });
			continue;
		}
		if (pkg.private === true) continue;
		if (pkg.license !== NPM_LICENSE_FIELD) {
			findings.push({
				class: 'package_license_field',
				detail: `${rel} license=${JSON.stringify(pkg.license ?? null)} (expected "${NPM_LICENSE_FIELD}")`
			});
		}
	}
	const uncovered = [];
	for (const rel of tracked) {
		const abs = join(root, rel);
		if (hasSpdxHeader(abs)) continue;
		if (globs.some((g) => g.test(rel))) continue;
		uncovered.push(rel);
	}
	const headerFindings = uncovered.length;
	if (headerFindings > 0) {
		findings.push({
			class: 'spdx_coverage',
			detail: `${headerFindings} tracked file(s) lack SPDX header and are not REUSE.toml-declared`,
			files: uncovered.slice(0, 25)
		});
	}

	return {
		schema: SCHEMA,
		version: VERSION,
		repo: root,
		ok: findings.length === 0,
		findings,
		checked: { tracked: tracked.length, uncovered: headerFindings }
	};
}

// --- twin-drift check -----------------------------------------------------
// The per-repo `scripts/license-gate.mjs` twin is generated by
// `bin/ozzydev-license-scaffold.mjs` and stamped with this owner file's body
// sha256 (the body is this file with the shebang stripped). `--verify-twins`
// compares each twin's stamp to the CURRENT owner body sha, so a twin that has
// fallen behind the owner — running stale gate logic — is caught loudly. The
// walk is owner-only: a twin has no owner sha to compare against, so running
// the mode from a twin refuses `not_owner` instead of guessing.
export const TWIN_STAMP_RE = /^\/\/ owner_version: (\S+) · owner_sha256: ([0-9a-f]{64})$/m;

export function ownerBodySha(ownerSource) {
	return createHash('sha256')
		.update(ownerSource.replace(/^#![^\n]*\n/, ''))
		.digest('hex');
}

export function parseTwinStamp(twinSource) {
	const m = twinSource.match(TWIN_STAMP_RE);
	return m ? { version: m[1], sha256: m[2] } : null;
}

export function twinDrift(twinSource, expectedSha) {
	const stamp = parseTwinStamp(twinSource);
	if (!stamp) return { status: 'missing_stamp' };
	if (stamp.sha256 !== expectedSha) {
		return { status: 'drift', found: stamp.sha256, expected: expectedSha };
	}
	return { status: 'ok', version: stamp.version };
}

export function verifyTwins(workspace, ownerSource) {
	const root = resolve(workspace);
	if (!existsSync(root)) {
		const e = new Error(`workspace_unreadable: ${root}`);
		e.code = 'workspace_unreadable';
		throw e;
	}
	const expectedSha = ownerBodySha(ownerSource);
	const twins = [];
	for (const name of readdirSync(root)) {
		if (name.startsWith('_') || name.startsWith('.')) continue;
		const repoDir = join(root, name);
		if (!existsSync(join(repoDir, '.git'))) continue;
		const twinPath = join(repoDir, 'scripts', 'license-gate.mjs');
		if (!existsSync(twinPath)) {
			twins.push({ repo: name, twin: twinPath, status: 'twin_missing' });
			continue;
		}
		twins.push({
			repo: name,
			twin: twinPath,
			...twinDrift(readFileSync(twinPath, 'utf8'), expectedSha)
		});
	}
	// `twin_missing` is reported but never fails this check: the contract is
	// "the twin that exists matches the owner sha". A repo without a twin is a
	// coverage question for the license scaffold, not twin drift.
	const stale = twins.filter((t) => t.status === 'drift' || t.status === 'missing_stamp');
	return {
		schema: SCHEMA,
		version: VERSION,
		workspace: root,
		owner_sha256: expectedSha,
		ok: stale.length === 0,
		stale: stale.length,
		missing: twins.filter((t) => t.status === 'twin_missing').length,
		twins
	};
}

function main(argv) {
	const args = {
		repo: process.cwd(),
		json: false,
		strict: false,
		verifyTwins: false,
		workspace: null
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--help' || a === '-h') {
			process.stdout.write(usageText() + '\n');
			return 0;
		} else if (a === '--repo') args.repo = argv[++i];
		else if (a === '--json') args.json = true;
		else if (a === '--strict') args.strict = true;
		else if (a === '--verify-twins') args.verifyTwins = true;
		else if (a === '--workspace') args.workspace = argv[++i];
		else {
			process.stderr.write(`unknown flag: ${a}\n${usageText()}\n`);
			return 2;
		}
	}
	if (args.verifyTwins) {
		const ownerPath = fileURLToPath(import.meta.url);
		const invoked = process.argv[1] ? process.argv[1].split(/[/\\]/).pop() : '';
		if (invoked !== 'ozzydev-license-gate.mjs') {
			process.stderr.write(
				`license-gate: not_owner: --verify-twins must run from bin/ozzydev-license-gate.mjs ` +
					`(a generated twin has no owner sha to compare against)\n`
			);
			return 3;
		}
		const workspace = args.workspace ?? dirname(dirname(dirname(ownerPath)));
		let twins;
		try {
			twins = verifyTwins(workspace, readFileSync(ownerPath, 'utf8'));
		} catch (err) {
			process.stderr.write(`license-gate: ${err.code ?? 'error'}: ${err.message}\n`);
			return 3;
		}
		if (args.json) {
			process.stdout.write(JSON.stringify(twins, null, 2) + '\n');
		} else {
			process.stdout.write(
				`license-gate twin-drift ${twins.workspace} — owner_sha256=${twins.owner_sha256}\n`
			);
			for (const t of twins.twins) {
				const extra = t.status === 'drift' ? ` (found ${t.found})` : '';
				process.stdout.write(`  ${t.status.padEnd(14)} ${t.repo}${extra}\n`);
			}
			process.stdout.write(
				twins.ok
					? `OK — every twin matches the owner${twins.missing ? ` (${twins.missing} repo(s) ship no twin)` : ''}\n`
					: `DRIFT — ${twins.stale} twin(s) not current${twins.missing ? `; ${twins.missing} repo(s) ship no twin` : ''}\n`
			);
		}
		return twins.ok ? 0 : 1;
	}
	let res;
	try {
		res = runGate(args.repo);
	} catch (err) {
		process.stderr.write(`license-gate: ${err.code ?? 'error'}: ${err.message}\n`);
		return 3;
	}
	if (args.json) {
		process.stdout.write(JSON.stringify(res, null, 2) + '\n');
	} else if (res.ok) {
		process.stdout.write(
			`OK license-gate ${res.repo} — tracked=${res.checked.tracked} uncovered=0\n`
		);
	} else {
		process.stdout.write(`FAIL license-gate ${res.repo} — ${res.findings.length} finding(s)\n`);
		for (const f of res.findings) {
			process.stdout.write(`  - ${f.class}: ${f.detail}\n`);
			if (f.files) for (const x of f.files) process.stdout.write(`      ${x}\n`);
		}
	}
	return res.ok ? 0 : 1;
}

// Entrypoint guard: realpath BOTH sides — never the raw argv path, and never a
// bare URL-form comparison. `import.meta.url` is realpathed by Node AND
// percent-encodes characters such as the space in `/Users/x/My Cubicle/...`, so
// BOTH prior shapes were false and `main()` never ran — the gate exited 0
// having checked nothing (success-shaped silent no-op): the raw string compare
// failed on a path with a space (measured 2026-09-14), and the `pathToFileURL`
// URL compare still failed on any symlinked prefix (`/var`→`/private/var`,
// `/tmp`→`/private/tmp`, agent scratch under `$TMPDIR`). Same class as
// `bin/lib/is-main.mjs`; inlined here because this file is copied VERBATIM into
// every repo as `scripts/license-gate.mjs` and must stay node-builtins-only and
// self-contained (a `./lib/is-main.mjs` import would be missing in every twin).
function isMainModule() {
	if (!process.argv[1]) return false;
	try {
		return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
	} catch {
		return false;
	}
}
if (isMainModule()) {
	process.exit(main(process.argv.slice(2)));
}
