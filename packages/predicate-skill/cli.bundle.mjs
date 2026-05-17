#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/IRIs.js
var require_IRIs = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/IRIs.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
    var XSD = "http://www.w3.org/2001/XMLSchema#";
    var SWAP = "http://www.w3.org/2000/10/swap/";
    var _default = exports.default = {
      xsd: {
        decimal: `${XSD}decimal`,
        boolean: `${XSD}boolean`,
        double: `${XSD}double`,
        integer: `${XSD}integer`,
        string: `${XSD}string`
      },
      rdf: {
        type: `${RDF}type`,
        nil: `${RDF}nil`,
        first: `${RDF}first`,
        rest: `${RDF}rest`,
        langString: `${RDF}langString`
      },
      owl: {
        sameAs: "http://www.w3.org/2002/07/owl#sameAs"
      },
      r: {
        forSome: `${SWAP}reify#forSome`,
        forAll: `${SWAP}reify#forAll`
      },
      log: {
        implies: `${SWAP}log#implies`,
        isImpliedBy: `${SWAP}log#isImpliedBy`
      }
    };
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Lexer.js
var require_N3Lexer = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Lexer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _buffer = __require("buffer");
    var _IRIs = _interopRequireDefault(require_IRIs());
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : { default: e };
    }
    var {
      xsd: xsd2
    } = _IRIs.default;
    var escapeSequence = /\\u([a-fA-F0-9]{4})|\\U([a-fA-F0-9]{8})|\\([^])/g;
    var escapeReplacements = {
      "\\": "\\",
      "'": "'",
      '"': '"',
      "n": "\n",
      "r": "\r",
      "t": "	",
      "f": "\f",
      "b": "\b",
      "_": "_",
      "~": "~",
      ".": ".",
      "-": "-",
      "!": "!",
      "$": "$",
      "&": "&",
      "(": "(",
      ")": ")",
      "*": "*",
      "+": "+",
      ",": ",",
      ";": ";",
      "=": "=",
      "/": "/",
      "?": "?",
      "#": "#",
      "@": "@",
      "%": "%"
    };
    var illegalIriChars = /[\x00-\x20<>\\"\{\}\|\^\`]/;
    var lineModeRegExps = {
      _iri: true,
      _unescapedIri: true,
      _simpleQuotedString: true,
      _langcode: true,
      _blank: true,
      _newline: true,
      _comment: true,
      _whitespace: true,
      _endOfFile: true
    };
    var invalidRegExp = /$0^/;
    var N3Lexer = class {
      constructor(options) {
        this._iri = /^<((?:[^ <>{}\\]|\\[uU])+)>[ \t]*/;
        this._unescapedIri = /^<([^\x00-\x20<>\\"\{\}\|\^\`]*)>[ \t]*/;
        this._simpleQuotedString = /^"([^"\\\r\n]*)"(?=[^"])/;
        this._simpleApostropheString = /^'([^'\\\r\n]*)'(?=[^'])/;
        this._langcode = /^@([a-z]+(?:-[a-z0-9]+)*)(?=[^a-z0-9\-])/i;
        this._prefix = /^((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:(?=[#\s<])/;
        this._prefixed = /^((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:((?:(?:[0-:A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])(?:(?:[\.\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])*(?:[\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~]))?)?)(?:[ \t]+|(?=\.?[,;!\^\s#()\[\]\{\}"'<>]))/;
        this._variable = /^\?(?:(?:[A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:[\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)(?=[.,;!\^\s#()\[\]\{\}"'<>])/;
        this._blank = /^_:((?:[0-9A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)(?:[ \t]+|(?=\.?[,;:\s#()\[\]\{\}"'<>]))/;
        this._number = /^[\-+]?(?:(\d+\.\d*|\.?\d+)[eE][\-+]?|\d*(\.)?)\d+(?=\.?[,;:\s#()\[\]\{\}"'<>])/;
        this._boolean = /^(?:true|false)(?=[.,;\s#()\[\]\{\}"'<>])/;
        this._keyword = /^@[a-z]+(?=[\s#<:])/i;
        this._sparqlKeyword = /^(?:PREFIX|BASE|GRAPH)(?=[\s#<])/i;
        this._shortPredicates = /^a(?=[\s#()\[\]\{\}"'<>])/;
        this._newline = /^[ \t]*(?:#[^\n\r]*)?(?:\r\n|\n|\r)[ \t]*/;
        this._comment = /#([^\n\r]*)/;
        this._whitespace = /^[ \t]+/;
        this._endOfFile = /^(?:#[^\n\r]*)?$/;
        options = options || {};
        this._isImpliedBy = options.isImpliedBy;
        if (this._lineMode = !!options.lineMode) {
          this._n3Mode = false;
          for (const key in this) {
            if (!(key in lineModeRegExps) && this[key] instanceof RegExp) this[key] = invalidRegExp;
          }
        } else {
          this._n3Mode = options.n3 !== false;
        }
        this.comments = !!options.comments;
        this._literalClosingPos = 0;
      }
      // ## Private methods
      // ### `_tokenizeToEnd` tokenizes as for as possible, emitting tokens through the callback
      _tokenizeToEnd(callback, inputFinished) {
        let input = this._input;
        let currentLineLength = input.length;
        while (true) {
          let whiteSpaceMatch, comment;
          while (whiteSpaceMatch = this._newline.exec(input)) {
            if (this.comments && (comment = this._comment.exec(whiteSpaceMatch[0]))) emitToken("comment", comment[1], "", this._line, whiteSpaceMatch[0].length);
            input = input.substr(whiteSpaceMatch[0].length, input.length);
            currentLineLength = input.length;
            this._line++;
          }
          if (!whiteSpaceMatch && (whiteSpaceMatch = this._whitespace.exec(input))) input = input.substr(whiteSpaceMatch[0].length, input.length);
          if (this._endOfFile.test(input)) {
            if (inputFinished) {
              if (this.comments && (comment = this._comment.exec(input))) emitToken("comment", comment[1], "", this._line, input.length);
              input = null;
              emitToken("eof", "", "", this._line, 0);
            }
            return this._input = input;
          }
          const line = this._line, firstChar = input[0];
          let type = "", value = "", prefix = "", match = null, matchLength = 0, inconclusive = false;
          switch (firstChar) {
            case "^":
              if (input.length < 3) break;
              else if (input[1] === "^") {
                this._previousMarker = "^^";
                input = input.substr(2);
                if (input[0] !== "<") {
                  inconclusive = true;
                  break;
                }
              } else {
                if (this._n3Mode) {
                  matchLength = 1;
                  type = "^";
                }
                break;
              }
            // Fall through in case the type is an IRI
            case "<":
              if (match = this._unescapedIri.exec(input)) type = "IRI", value = match[1];
              else if (match = this._iri.exec(input)) {
                value = this._unescape(match[1]);
                if (value === null || illegalIriChars.test(value)) return reportSyntaxError(this);
                type = "IRI";
              } else if (input.length > 1 && input[1] === "<") type = "<<", matchLength = 2;
              else if (this._n3Mode && input.length > 1 && input[1] === "=") {
                matchLength = 2;
                if (this._isImpliedBy) type = "abbreviation", value = "<";
                else type = "inverse", value = ">";
              }
              break;
            case ">":
              if (input.length > 1 && input[1] === ">") type = ">>", matchLength = 2;
              break;
            case "_":
              if ((match = this._blank.exec(input)) || inputFinished && (match = this._blank.exec(`${input} `))) type = "blank", prefix = "_", value = match[1];
              break;
            case '"':
              if (match = this._simpleQuotedString.exec(input)) value = match[1];
              else {
                ({
                  value,
                  matchLength
                } = this._parseLiteral(input));
                if (value === null) return reportSyntaxError(this);
              }
              if (match !== null || matchLength !== 0) {
                type = "literal";
                this._literalClosingPos = 0;
              }
              break;
            case "'":
              if (!this._lineMode) {
                if (match = this._simpleApostropheString.exec(input)) value = match[1];
                else {
                  ({
                    value,
                    matchLength
                  } = this._parseLiteral(input));
                  if (value === null) return reportSyntaxError(this);
                }
                if (match !== null || matchLength !== 0) {
                  type = "literal";
                  this._literalClosingPos = 0;
                }
              }
              break;
            case "?":
              if (this._n3Mode && (match = this._variable.exec(input))) type = "var", value = match[0];
              break;
            case "@":
              if (this._previousMarker === "literal" && (match = this._langcode.exec(input))) type = "langcode", value = match[1];
              else if (match = this._keyword.exec(input)) type = match[0];
              break;
            case ".":
              if (input.length === 1 ? inputFinished : input[1] < "0" || input[1] > "9") {
                type = ".";
                matchLength = 1;
                break;
              }
            // Fall through to numerical case (could be a decimal dot)
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9":
            case "+":
            case "-":
              if (match = this._number.exec(input) || inputFinished && (match = this._number.exec(`${input} `))) {
                type = "literal", value = match[0];
                prefix = typeof match[1] === "string" ? xsd2.double : typeof match[2] === "string" ? xsd2.decimal : xsd2.integer;
              }
              break;
            case "B":
            case "b":
            case "p":
            case "P":
            case "G":
            case "g":
              if (match = this._sparqlKeyword.exec(input)) type = match[0].toUpperCase();
              else inconclusive = true;
              break;
            case "f":
            case "t":
              if (match = this._boolean.exec(input)) type = "literal", value = match[0], prefix = xsd2.boolean;
              else inconclusive = true;
              break;
            case "a":
              if (match = this._shortPredicates.exec(input)) type = "abbreviation", value = "a";
              else inconclusive = true;
              break;
            case "=":
              if (this._n3Mode && input.length > 1) {
                type = "abbreviation";
                if (input[1] !== ">") matchLength = 1, value = "=";
                else matchLength = 2, value = ">";
              }
              break;
            case "!":
              if (!this._n3Mode) break;
            case ",":
            case ";":
            case "[":
            case "]":
            case "(":
            case ")":
            case "}":
              if (!this._lineMode) {
                matchLength = 1;
                type = firstChar;
              }
              break;
            case "{":
              if (!this._lineMode && input.length >= 2) {
                if (input[1] === "|") type = "{|", matchLength = 2;
                else type = firstChar, matchLength = 1;
              }
              break;
            case "|":
              if (input.length >= 2 && input[1] === "}") type = "|}", matchLength = 2;
              break;
            default:
              inconclusive = true;
          }
          if (inconclusive) {
            if ((this._previousMarker === "@prefix" || this._previousMarker === "PREFIX") && (match = this._prefix.exec(input))) type = "prefix", value = match[1] || "";
            else if ((match = this._prefixed.exec(input)) || inputFinished && (match = this._prefixed.exec(`${input} `))) type = "prefixed", prefix = match[1] || "", value = this._unescape(match[2]);
          }
          if (this._previousMarker === "^^") {
            switch (type) {
              case "prefixed":
                type = "type";
                break;
              case "IRI":
                type = "typeIRI";
                break;
              default:
                type = "";
            }
          }
          if (!type) {
            if (inputFinished || !/^'''|^"""/.test(input) && /\n|\r/.test(input)) return reportSyntaxError(this);
            else return this._input = input;
          }
          const length = matchLength || match[0].length;
          const token = emitToken(type, value, prefix, line, length);
          this.previousToken = token;
          this._previousMarker = type;
          input = input.substr(length, input.length);
        }
        function emitToken(type, value, prefix, line, length) {
          const start = input ? currentLineLength - input.length : currentLineLength;
          const end = start + length;
          const token = {
            type,
            value,
            prefix,
            line,
            start,
            end
          };
          callback(null, token);
          return token;
        }
        function reportSyntaxError(self) {
          callback(self._syntaxError(/^\S*/.exec(input)[0]));
        }
      }
      // ### `_unescape` replaces N3 escape codes by their corresponding characters
      _unescape(item) {
        let invalid = false;
        const replaced = item.replace(escapeSequence, (sequence, unicode4, unicode8, escapedChar) => {
          if (typeof unicode4 === "string") return String.fromCharCode(Number.parseInt(unicode4, 16));
          if (typeof unicode8 === "string") {
            let charCode = Number.parseInt(unicode8, 16);
            return charCode <= 65535 ? String.fromCharCode(Number.parseInt(unicode8, 16)) : String.fromCharCode(55296 + ((charCode -= 65536) >> 10), 56320 + (charCode & 1023));
          }
          if (escapedChar in escapeReplacements) return escapeReplacements[escapedChar];
          invalid = true;
          return "";
        });
        return invalid ? null : replaced;
      }
      // ### `_parseLiteral` parses a literal into an unescaped value
      _parseLiteral(input) {
        if (input.length >= 3) {
          const opening = input.match(/^(?:"""|"|'''|'|)/)[0];
          const openingLength = opening.length;
          let closingPos = Math.max(this._literalClosingPos, openingLength);
          while ((closingPos = input.indexOf(opening, closingPos)) > 0) {
            let backslashCount = 0;
            while (input[closingPos - backslashCount - 1] === "\\") backslashCount++;
            if (backslashCount % 2 === 0) {
              const raw = input.substring(openingLength, closingPos);
              const lines = raw.split(/\r\n|\r|\n/).length - 1;
              const matchLength = closingPos + openingLength;
              if (openingLength === 1 && lines !== 0 || openingLength === 3 && this._lineMode) break;
              this._line += lines;
              return {
                value: this._unescape(raw),
                matchLength
              };
            }
            closingPos++;
          }
          this._literalClosingPos = input.length - openingLength + 1;
        }
        return {
          value: "",
          matchLength: 0
        };
      }
      // ### `_syntaxError` creates a syntax error for the given issue
      _syntaxError(issue) {
        this._input = null;
        const err2 = new Error(`Unexpected "${issue}" on line ${this._line}.`);
        err2.context = {
          token: void 0,
          line: this._line,
          previousToken: this.previousToken
        };
        return err2;
      }
      // ### Strips off any starting UTF BOM mark.
      _readStartingBom(input) {
        return input.startsWith("\uFEFF") ? input.substr(1) : input;
      }
      // ## Public methods
      // ### `tokenize` starts the transformation of an N3 document into an array of tokens.
      // The input can be a string or a stream.
      tokenize(input, callback) {
        this._line = 1;
        if (typeof input === "string") {
          this._input = this._readStartingBom(input);
          if (typeof callback === "function") queueMicrotask(() => this._tokenizeToEnd(callback, true));
          else {
            const tokens = [];
            let error2;
            this._tokenizeToEnd((e, t) => e ? error2 = e : tokens.push(t), true);
            if (error2) throw error2;
            return tokens;
          }
        } else {
          this._pendingBuffer = null;
          if (typeof input.setEncoding === "function") input.setEncoding("utf8");
          input.on("data", (data) => {
            if (this._input !== null && data.length !== 0) {
              if (this._pendingBuffer) {
                data = _buffer.Buffer.concat([this._pendingBuffer, data]);
                this._pendingBuffer = null;
              }
              if (data[data.length - 1] & 128) {
                this._pendingBuffer = data;
              } else {
                if (typeof this._input === "undefined") this._input = this._readStartingBom(typeof data === "string" ? data : data.toString());
                else this._input += data;
                this._tokenizeToEnd(callback, false);
              }
            }
          });
          input.on("end", () => {
            if (typeof this._input === "string") this._tokenizeToEnd(callback, true);
          });
          input.on("error", callback);
        }
      }
    };
    exports.default = N3Lexer;
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3DataFactory.js
var require_N3DataFactory = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3DataFactory.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = exports.Variable = exports.Triple = exports.Term = exports.Quad = exports.NamedNode = exports.Literal = exports.DefaultGraph = exports.BlankNode = void 0;
    exports.escapeQuotes = escapeQuotes2;
    exports.fromQuad = fromQuad;
    exports.fromTerm = fromTerm2;
    exports.termFromId = termFromId;
    exports.termToId = termToId2;
    exports.unescapeQuotes = unescapeQuotes;
    var _IRIs = _interopRequireDefault(require_IRIs());
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : { default: e };
    }
    var {
      rdf,
      xsd: xsd2
    } = _IRIs.default;
    var DEFAULTGRAPH;
    var _blankNodeCounter = 0;
    var escapedLiteral2 = /^"(.*".*)(?="[^"]*$)/;
    var DataFactory2 = {
      namedNode: namedNode3,
      blankNode: blankNode3,
      variable: variable2,
      literal: literal3,
      defaultGraph: defaultGraph2,
      quad: quad2,
      triple: quad2,
      fromTerm: fromTerm2,
      fromQuad
    };
    var _default = exports.default = DataFactory2;
    var Term = class _Term {
      constructor(id) {
        this.id = id;
      }
      // ### The value of this term
      get value() {
        return this.id;
      }
      // ### Returns whether this object represents the same term as the other
      equals(other) {
        if (other instanceof _Term) return this.id === other.id;
        return !!other && this.termType === other.termType && this.value === other.value;
      }
      // ### Implement hashCode for Immutable.js, since we implement `equals`
      // https://immutable-js.com/docs/v4.0.0/ValueObject/#hashCode()
      hashCode() {
        return 0;
      }
      // ### Returns a plain object representation of this term
      toJSON() {
        return {
          termType: this.termType,
          value: this.value
        };
      }
    };
    exports.Term = Term;
    var NamedNode2 = class extends Term {
      // ### The term type of this term
      get termType() {
        return "NamedNode";
      }
    };
    exports.NamedNode = NamedNode2;
    var Literal2 = class _Literal extends Term {
      // ### The term type of this term
      get termType() {
        return "Literal";
      }
      // ### The text value of this literal
      get value() {
        return this.id.substring(1, this.id.lastIndexOf('"'));
      }
      // ### The language of this literal
      get language() {
        const id = this.id;
        let atPos = id.lastIndexOf('"') + 1;
        return atPos < id.length && id[atPos++] === "@" ? id.substr(atPos).toLowerCase() : "";
      }
      // ### The datatype IRI of this literal
      get datatype() {
        return new NamedNode2(this.datatypeString);
      }
      // ### The datatype string of this literal
      get datatypeString() {
        const id = this.id, dtPos = id.lastIndexOf('"') + 1;
        const char = dtPos < id.length ? id[dtPos] : "";
        return char === "^" ? id.substr(dtPos + 2) : (
          // If "@" follows, return rdf:langString; xsd:string otherwise
          char !== "@" ? xsd2.string : rdf.langString
        );
      }
      // ### Returns whether this object represents the same term as the other
      equals(other) {
        if (other instanceof _Literal) return this.id === other.id;
        return !!other && !!other.datatype && this.termType === other.termType && this.value === other.value && this.language === other.language && this.datatype.value === other.datatype.value;
      }
      toJSON() {
        return {
          termType: this.termType,
          value: this.value,
          language: this.language,
          datatype: {
            termType: "NamedNode",
            value: this.datatypeString
          }
        };
      }
    };
    exports.Literal = Literal2;
    var BlankNode2 = class extends Term {
      constructor(name) {
        super(`_:${name}`);
      }
      // ### The term type of this term
      get termType() {
        return "BlankNode";
      }
      // ### The name of this blank node
      get value() {
        return this.id.substr(2);
      }
    };
    exports.BlankNode = BlankNode2;
    var Variable2 = class extends Term {
      constructor(name) {
        super(`?${name}`);
      }
      // ### The term type of this term
      get termType() {
        return "Variable";
      }
      // ### The name of this variable
      get value() {
        return this.id.substr(1);
      }
    };
    exports.Variable = Variable2;
    var DefaultGraph2 = class extends Term {
      constructor() {
        super("");
        return DEFAULTGRAPH || this;
      }
      // ### The term type of this term
      get termType() {
        return "DefaultGraph";
      }
      // ### Returns whether this object represents the same term as the other
      equals(other) {
        return this === other || !!other && this.termType === other.termType;
      }
    };
    exports.DefaultGraph = DefaultGraph2;
    DEFAULTGRAPH = new DefaultGraph2();
    function termFromId(id, factory3, nested) {
      factory3 = factory3 || DataFactory2;
      if (!id) return factory3.defaultGraph();
      switch (id[0]) {
        case "?":
          return factory3.variable(id.substr(1));
        case "_":
          return factory3.blankNode(id.substr(2));
        case '"':
          if (factory3 === DataFactory2) return new Literal2(id);
          if (id[id.length - 1] === '"') return factory3.literal(id.substr(1, id.length - 2));
          const endPos = id.lastIndexOf('"', id.length - 1);
          return factory3.literal(id.substr(1, endPos - 1), id[endPos + 1] === "@" ? id.substr(endPos + 2) : factory3.namedNode(id.substr(endPos + 3)));
        case "[":
          id = JSON.parse(id);
          break;
        default:
          if (!nested || !Array.isArray(id)) {
            return factory3.namedNode(id);
          }
      }
      return factory3.quad(termFromId(id[0], factory3, true), termFromId(id[1], factory3, true), termFromId(id[2], factory3, true), id[3] && termFromId(id[3], factory3, true));
    }
    function termToId2(term2, nested) {
      if (typeof term2 === "string") return term2;
      if (term2 instanceof Term && term2.termType !== "Quad") return term2.id;
      if (!term2) return DEFAULTGRAPH.id;
      switch (term2.termType) {
        case "NamedNode":
          return term2.value;
        case "BlankNode":
          return `_:${term2.value}`;
        case "Variable":
          return `?${term2.value}`;
        case "DefaultGraph":
          return "";
        case "Literal":
          return `"${term2.value}"${term2.language ? `@${term2.language}` : term2.datatype && term2.datatype.value !== xsd2.string ? `^^${term2.datatype.value}` : ""}`;
        case "Quad":
          const res = [termToId2(term2.subject, true), termToId2(term2.predicate, true), termToId2(term2.object, true)];
          if (term2.graph && term2.graph.termType !== "DefaultGraph") {
            res.push(termToId2(term2.graph, true));
          }
          return nested ? res : JSON.stringify(res);
        default:
          throw new Error(`Unexpected termType: ${term2.termType}`);
      }
    }
    var Quad2 = class extends Term {
      constructor(subject, predicate, object, graph) {
        super("");
        this._subject = subject;
        this._predicate = predicate;
        this._object = object;
        this._graph = graph || DEFAULTGRAPH;
      }
      // ### The term type of this term
      get termType() {
        return "Quad";
      }
      get subject() {
        return this._subject;
      }
      get predicate() {
        return this._predicate;
      }
      get object() {
        return this._object;
      }
      get graph() {
        return this._graph;
      }
      // ### Returns a plain object representation of this quad
      toJSON() {
        return {
          termType: this.termType,
          subject: this._subject.toJSON(),
          predicate: this._predicate.toJSON(),
          object: this._object.toJSON(),
          graph: this._graph.toJSON()
        };
      }
      // ### Returns whether this object represents the same quad as the other
      equals(other) {
        return !!other && this._subject.equals(other.subject) && this._predicate.equals(other.predicate) && this._object.equals(other.object) && this._graph.equals(other.graph);
      }
    };
    exports.Triple = exports.Quad = Quad2;
    function escapeQuotes2(id) {
      return id.replace(escapedLiteral2, (_, quoted) => `"${quoted.replace(/"/g, '""')}`);
    }
    function unescapeQuotes(id) {
      return id.replace(escapedLiteral2, (_, quoted) => `"${quoted.replace(/""/g, '"')}`);
    }
    function namedNode3(iri) {
      return new NamedNode2(iri);
    }
    function blankNode3(name) {
      return new BlankNode2(name || `n3-${_blankNodeCounter++}`);
    }
    function literal3(value, languageOrDataType) {
      if (typeof languageOrDataType === "string") return new Literal2(`"${value}"@${languageOrDataType.toLowerCase()}`);
      let datatype = languageOrDataType ? languageOrDataType.value : "";
      if (datatype === "") {
        if (typeof value === "boolean") datatype = xsd2.boolean;
        else if (typeof value === "number") {
          if (Number.isFinite(value)) datatype = Number.isInteger(value) ? xsd2.integer : xsd2.double;
          else {
            datatype = xsd2.double;
            if (!Number.isNaN(value)) value = value > 0 ? "INF" : "-INF";
          }
        }
      }
      return datatype === "" || datatype === xsd2.string ? new Literal2(`"${value}"`) : new Literal2(`"${value}"^^${datatype}`);
    }
    function variable2(name) {
      return new Variable2(name);
    }
    function defaultGraph2() {
      return DEFAULTGRAPH;
    }
    function quad2(subject, predicate, object, graph) {
      return new Quad2(subject, predicate, object, graph);
    }
    function fromTerm2(term2) {
      if (term2 instanceof Term) return term2;
      switch (term2.termType) {
        case "NamedNode":
          return namedNode3(term2.value);
        case "BlankNode":
          return blankNode3(term2.value);
        case "Variable":
          return variable2(term2.value);
        case "DefaultGraph":
          return DEFAULTGRAPH;
        case "Literal":
          return literal3(term2.value, term2.language || term2.datatype);
        case "Quad":
          return fromQuad(term2);
        default:
          throw new Error(`Unexpected termType: ${term2.termType}`);
      }
    }
    function fromQuad(inQuad) {
      if (inQuad instanceof Quad2) return inQuad;
      if (inQuad.termType !== "Quad") throw new Error(`Unexpected termType: ${inQuad.termType}`);
      return quad2(fromTerm2(inQuad.subject), fromTerm2(inQuad.predicate), fromTerm2(inQuad.object), fromTerm2(inQuad.graph));
    }
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Parser.js
var require_N3Parser = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Parser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _N3Lexer = _interopRequireDefault(require_N3Lexer());
    var _N3DataFactory = _interopRequireDefault(require_N3DataFactory());
    var _IRIs = _interopRequireDefault(require_IRIs());
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : { default: e };
    }
    var blankNodePrefix = 0;
    var N3Parser = class {
      constructor(options) {
        this._contextStack = [];
        this._graph = null;
        options = options || {};
        this._setBase(options.baseIRI);
        options.factory && initDataFactory(this, options.factory);
        const format = typeof options.format === "string" ? options.format.match(/\w*$/)[0].toLowerCase() : "", isTurtle = /turtle/.test(format), isTriG = /trig/.test(format), isNTriples = /triple/.test(format), isNQuads = /quad/.test(format), isN3 = this._n3Mode = /n3/.test(format), isLineMode = isNTriples || isNQuads;
        if (!(this._supportsNamedGraphs = !(isTurtle || isN3))) this._readPredicateOrNamedGraph = this._readPredicate;
        this._supportsQuads = !(isTurtle || isTriG || isNTriples || isN3);
        this._isImpliedBy = options.isImpliedBy;
        this._supportsRDFStar = format === "" || /star|\*$/.test(format);
        if (isLineMode) this._resolveRelativeIRI = (iri) => {
          return null;
        };
        this._blankNodePrefix = typeof options.blankNodePrefix !== "string" ? "" : options.blankNodePrefix.replace(/^(?!_:)/, "_:");
        this._lexer = options.lexer || new _N3Lexer.default({
          lineMode: isLineMode,
          n3: isN3,
          isImpliedBy: this._isImpliedBy
        });
        this._explicitQuantifiers = !!options.explicitQuantifiers;
      }
      // ## Static class methods
      // ### `_resetBlankNodePrefix` restarts blank node prefix identification
      static _resetBlankNodePrefix() {
        blankNodePrefix = 0;
      }
      // ## Private methods
      // ### `_setBase` sets the base IRI to resolve relative IRIs
      _setBase(baseIRI) {
        if (!baseIRI) {
          this._base = "";
          this._basePath = "";
        } else {
          const fragmentPos = baseIRI.indexOf("#");
          if (fragmentPos >= 0) baseIRI = baseIRI.substr(0, fragmentPos);
          this._base = baseIRI;
          this._basePath = baseIRI.indexOf("/") < 0 ? baseIRI : baseIRI.replace(/[^\/?]*(?:\?.*)?$/, "");
          baseIRI = baseIRI.match(/^(?:([a-z][a-z0-9+.-]*:))?(?:\/\/[^\/]*)?/i);
          this._baseRoot = baseIRI[0];
          this._baseScheme = baseIRI[1];
        }
      }
      // ### `_saveContext` stores the current parsing context
      // when entering a new scope (list, blank node, formula)
      _saveContext(type, graph, subject, predicate, object) {
        const n3Mode = this._n3Mode;
        this._contextStack.push({
          type,
          subject,
          predicate,
          object,
          graph,
          inverse: n3Mode ? this._inversePredicate : false,
          blankPrefix: n3Mode ? this._prefixes._ : "",
          quantified: n3Mode ? this._quantified : null
        });
        if (n3Mode) {
          this._inversePredicate = false;
          this._prefixes._ = this._graph ? `${this._graph.value}.` : ".";
          this._quantified = Object.create(this._quantified);
        }
      }
      // ### `_restoreContext` restores the parent context
      // when leaving a scope (list, blank node, formula)
      _restoreContext(type, token) {
        const context = this._contextStack.pop();
        if (!context || context.type !== type) return this._error(`Unexpected ${token.type}`, token);
        this._subject = context.subject;
        this._predicate = context.predicate;
        this._object = context.object;
        this._graph = context.graph;
        if (this._n3Mode) {
          this._inversePredicate = context.inverse;
          this._prefixes._ = context.blankPrefix;
          this._quantified = context.quantified;
        }
      }
      // ### `_readInTopContext` reads a token when in the top context
      _readInTopContext(token) {
        switch (token.type) {
          // If an EOF token arrives in the top context, signal that we're done
          case "eof":
            if (this._graph !== null) return this._error("Unclosed graph", token);
            delete this._prefixes._;
            return this._callback(null, null, this._prefixes);
          // It could be a prefix declaration
          case "PREFIX":
            this._sparqlStyle = true;
          case "@prefix":
            return this._readPrefix;
          // It could be a base declaration
          case "BASE":
            this._sparqlStyle = true;
          case "@base":
            return this._readBaseIRI;
          // It could be a graph
          case "{":
            if (this._supportsNamedGraphs) {
              this._graph = "";
              this._subject = null;
              return this._readSubject;
            }
          case "GRAPH":
            if (this._supportsNamedGraphs) return this._readNamedGraphLabel;
          // Otherwise, the next token must be a subject
          default:
            return this._readSubject(token);
        }
      }
      // ### `_readEntity` reads an IRI, prefixed name, blank node, or variable
      _readEntity(token, quantifier) {
        let value;
        switch (token.type) {
          // Read a relative or absolute IRI
          case "IRI":
          case "typeIRI":
            const iri = this._resolveIRI(token.value);
            if (iri === null) return this._error("Invalid IRI", token);
            value = this._factory.namedNode(iri);
            break;
          // Read a prefixed name
          case "type":
          case "prefixed":
            const prefix = this._prefixes[token.prefix];
            if (prefix === void 0) return this._error(`Undefined prefix "${token.prefix}:"`, token);
            value = this._factory.namedNode(prefix + token.value);
            break;
          // Read a blank node
          case "blank":
            value = this._factory.blankNode(this._prefixes[token.prefix] + token.value);
            break;
          // Read a variable
          case "var":
            value = this._factory.variable(token.value.substr(1));
            break;
          // Everything else is not an entity
          default:
            return this._error(`Expected entity but got ${token.type}`, token);
        }
        if (!quantifier && this._n3Mode && value.id in this._quantified) value = this._quantified[value.id];
        return value;
      }
      // ### `_readSubject` reads a quad's subject
      _readSubject(token) {
        this._predicate = null;
        switch (token.type) {
          case "[":
            this._saveContext("blank", this._graph, this._subject = this._factory.blankNode(), null, null);
            return this._readBlankNodeHead;
          case "(":
            this._saveContext("list", this._graph, this.RDF_NIL, null, null);
            this._subject = null;
            return this._readListItem;
          case "{":
            if (!this._n3Mode) return this._error("Unexpected graph", token);
            this._saveContext("formula", this._graph, this._graph = this._factory.blankNode(), null, null);
            return this._readSubject;
          case "}":
            return this._readPunctuation(token);
          case "@forSome":
            if (!this._n3Mode) return this._error('Unexpected "@forSome"', token);
            this._subject = null;
            this._predicate = this.N3_FORSOME;
            this._quantifier = "blankNode";
            return this._readQuantifierList;
          case "@forAll":
            if (!this._n3Mode) return this._error('Unexpected "@forAll"', token);
            this._subject = null;
            this._predicate = this.N3_FORALL;
            this._quantifier = "variable";
            return this._readQuantifierList;
          case "literal":
            if (!this._n3Mode) return this._error("Unexpected literal", token);
            if (token.prefix.length === 0) {
              this._literalValue = token.value;
              return this._completeSubjectLiteral;
            } else this._subject = this._factory.literal(token.value, this._factory.namedNode(token.prefix));
            break;
          case "<<":
            if (!this._supportsRDFStar) return this._error("Unexpected RDF-star syntax", token);
            this._saveContext("<<", this._graph, null, null, null);
            this._graph = null;
            return this._readSubject;
          default:
            if ((this._subject = this._readEntity(token)) === void 0) return;
            if (this._n3Mode) return this._getPathReader(this._readPredicateOrNamedGraph);
        }
        return this._readPredicateOrNamedGraph;
      }
      // ### `_readPredicate` reads a quad's predicate
      _readPredicate(token) {
        const type = token.type;
        switch (type) {
          case "inverse":
            this._inversePredicate = true;
          case "abbreviation":
            this._predicate = this.ABBREVIATIONS[token.value];
            break;
          case ".":
          case "]":
          case "}":
            if (this._predicate === null) return this._error(`Unexpected ${type}`, token);
            this._subject = null;
            return type === "]" ? this._readBlankNodeTail(token) : this._readPunctuation(token);
          case ";":
            return this._predicate !== null ? this._readPredicate : this._error("Expected predicate but got ;", token);
          case "[":
            if (this._n3Mode) {
              this._saveContext("blank", this._graph, this._subject, this._subject = this._factory.blankNode(), null);
              return this._readBlankNodeHead;
            }
          case "blank":
            if (!this._n3Mode) return this._error("Disallowed blank node as predicate", token);
          default:
            if ((this._predicate = this._readEntity(token)) === void 0) return;
        }
        return this._readObject;
      }
      // ### `_readObject` reads a quad's object
      _readObject(token) {
        switch (token.type) {
          case "literal":
            if (token.prefix.length === 0) {
              this._literalValue = token.value;
              return this._readDataTypeOrLang;
            } else this._object = this._factory.literal(token.value, this._factory.namedNode(token.prefix));
            break;
          case "[":
            this._saveContext("blank", this._graph, this._subject, this._predicate, this._subject = this._factory.blankNode());
            return this._readBlankNodeHead;
          case "(":
            this._saveContext("list", this._graph, this._subject, this._predicate, this.RDF_NIL);
            this._subject = null;
            return this._readListItem;
          case "{":
            if (!this._n3Mode) return this._error("Unexpected graph", token);
            this._saveContext("formula", this._graph, this._subject, this._predicate, this._graph = this._factory.blankNode());
            return this._readSubject;
          case "<<":
            if (!this._supportsRDFStar) return this._error("Unexpected RDF-star syntax", token);
            this._saveContext("<<", this._graph, this._subject, this._predicate, null);
            this._graph = null;
            return this._readSubject;
          default:
            if ((this._object = this._readEntity(token)) === void 0) return;
            if (this._n3Mode) return this._getPathReader(this._getContextEndReader());
        }
        return this._getContextEndReader();
      }
      // ### `_readPredicateOrNamedGraph` reads a quad's predicate, or a named graph
      _readPredicateOrNamedGraph(token) {
        return token.type === "{" ? this._readGraph(token) : this._readPredicate(token);
      }
      // ### `_readGraph` reads a graph
      _readGraph(token) {
        if (token.type !== "{") return this._error(`Expected graph but got ${token.type}`, token);
        this._graph = this._subject, this._subject = null;
        return this._readSubject;
      }
      // ### `_readBlankNodeHead` reads the head of a blank node
      _readBlankNodeHead(token) {
        if (token.type === "]") {
          this._subject = null;
          return this._readBlankNodeTail(token);
        } else {
          this._predicate = null;
          return this._readPredicate(token);
        }
      }
      // ### `_readBlankNodeTail` reads the end of a blank node
      _readBlankNodeTail(token) {
        if (token.type !== "]") return this._readBlankNodePunctuation(token);
        if (this._subject !== null) this._emit(this._subject, this._predicate, this._object, this._graph);
        const empty = this._predicate === null;
        this._restoreContext("blank", token);
        if (this._object !== null) return this._getContextEndReader();
        else if (this._predicate !== null) return this._readObject;
        else
          return empty ? this._readPredicateOrNamedGraph : this._readPredicateAfterBlank;
      }
      // ### `_readPredicateAfterBlank` reads a predicate after an anonymous blank node
      _readPredicateAfterBlank(token) {
        switch (token.type) {
          case ".":
          case "}":
            this._subject = null;
            return this._readPunctuation(token);
          default:
            return this._readPredicate(token);
        }
      }
      // ### `_readListItem` reads items from a list
      _readListItem(token) {
        let item = null, list = null, next = this._readListItem;
        const previousList = this._subject, stack = this._contextStack, parent = stack[stack.length - 1];
        switch (token.type) {
          case "[":
            this._saveContext("blank", this._graph, list = this._factory.blankNode(), this.RDF_FIRST, this._subject = item = this._factory.blankNode());
            next = this._readBlankNodeHead;
            break;
          case "(":
            this._saveContext("list", this._graph, list = this._factory.blankNode(), this.RDF_FIRST, this.RDF_NIL);
            this._subject = null;
            break;
          case ")":
            this._restoreContext("list", token);
            if (stack.length !== 0 && stack[stack.length - 1].type === "list") this._emit(this._subject, this._predicate, this._object, this._graph);
            if (this._predicate === null) {
              next = this._readPredicate;
              if (this._subject === this.RDF_NIL) return next;
            } else {
              next = this._getContextEndReader();
              if (this._object === this.RDF_NIL) return next;
            }
            list = this.RDF_NIL;
            break;
          case "literal":
            if (token.prefix.length === 0) {
              this._literalValue = token.value;
              next = this._readListItemDataTypeOrLang;
            } else {
              item = this._factory.literal(token.value, this._factory.namedNode(token.prefix));
              next = this._getContextEndReader();
            }
            break;
          case "{":
            if (!this._n3Mode) return this._error("Unexpected graph", token);
            this._saveContext("formula", this._graph, this._subject, this._predicate, this._graph = this._factory.blankNode());
            return this._readSubject;
          default:
            if ((item = this._readEntity(token)) === void 0) return;
        }
        if (list === null) this._subject = list = this._factory.blankNode();
        if (previousList === null) {
          if (parent.predicate === null) parent.subject = list;
          else parent.object = list;
        } else {
          this._emit(previousList, this.RDF_REST, list, this._graph);
        }
        if (item !== null) {
          if (this._n3Mode && (token.type === "IRI" || token.type === "prefixed")) {
            this._saveContext("item", this._graph, list, this.RDF_FIRST, item);
            this._subject = item, this._predicate = null;
            return this._getPathReader(this._readListItem);
          }
          this._emit(list, this.RDF_FIRST, item, this._graph);
        }
        return next;
      }
      // ### `_readDataTypeOrLang` reads an _optional_ datatype or language
      _readDataTypeOrLang(token) {
        return this._completeObjectLiteral(token, false);
      }
      // ### `_readListItemDataTypeOrLang` reads an _optional_ datatype or language in a list
      _readListItemDataTypeOrLang(token) {
        return this._completeObjectLiteral(token, true);
      }
      // ### `_completeLiteral` completes a literal with an optional datatype or language
      _completeLiteral(token) {
        let literal3 = this._factory.literal(this._literalValue);
        switch (token.type) {
          // Create a datatyped literal
          case "type":
          case "typeIRI":
            const datatype = this._readEntity(token);
            if (datatype === void 0) return;
            literal3 = this._factory.literal(this._literalValue, datatype);
            token = null;
            break;
          // Create a language-tagged string
          case "langcode":
            literal3 = this._factory.literal(this._literalValue, token.value);
            token = null;
            break;
        }
        return {
          token,
          literal: literal3
        };
      }
      // Completes a literal in subject position
      _completeSubjectLiteral(token) {
        this._subject = this._completeLiteral(token).literal;
        return this._readPredicateOrNamedGraph;
      }
      // Completes a literal in object position
      _completeObjectLiteral(token, listItem) {
        const completed = this._completeLiteral(token);
        if (!completed) return;
        this._object = completed.literal;
        if (listItem) this._emit(this._subject, this.RDF_FIRST, this._object, this._graph);
        if (completed.token === null) return this._getContextEndReader();
        else {
          this._readCallback = this._getContextEndReader();
          return this._readCallback(completed.token);
        }
      }
      // ### `_readFormulaTail` reads the end of a formula
      _readFormulaTail(token) {
        if (token.type !== "}") return this._readPunctuation(token);
        if (this._subject !== null) this._emit(this._subject, this._predicate, this._object, this._graph);
        this._restoreContext("formula", token);
        return this._object === null ? this._readPredicate : this._getContextEndReader();
      }
      // ### `_readPunctuation` reads punctuation between quads or quad parts
      _readPunctuation(token) {
        let next, graph = this._graph;
        const subject = this._subject, inversePredicate = this._inversePredicate;
        switch (token.type) {
          // A closing brace ends a graph
          case "}":
            if (this._graph === null) return this._error("Unexpected graph closing", token);
            if (this._n3Mode) return this._readFormulaTail(token);
            this._graph = null;
          // A dot just ends the statement, without sharing anything with the next
          case ".":
            this._subject = null;
            next = this._contextStack.length ? this._readSubject : this._readInTopContext;
            if (inversePredicate) this._inversePredicate = false;
            break;
          // Semicolon means the subject is shared; predicate and object are different
          case ";":
            next = this._readPredicate;
            break;
          // Comma means both the subject and predicate are shared; the object is different
          case ",":
            next = this._readObject;
            break;
          // {| means that the current triple is annotated with predicate-object pairs.
          case "{|":
            if (!this._supportsRDFStar) return this._error("Unexpected RDF-star syntax", token);
            const predicate = this._predicate, object = this._object;
            this._subject = this._factory.quad(subject, predicate, object, this.DEFAULTGRAPH);
            next = this._readPredicate;
            break;
          // |} means that the current quoted triple in annotation syntax is finalized.
          case "|}":
            if (this._subject.termType !== "Quad") return this._error("Unexpected asserted triple closing", token);
            this._subject = null;
            next = this._readPunctuation;
            break;
          default:
            if (this._supportsQuads && this._graph === null && (graph = this._readEntity(token)) !== void 0) {
              next = this._readQuadPunctuation;
              break;
            }
            return this._error(`Expected punctuation to follow "${this._object.id}"`, token);
        }
        if (subject !== null) {
          const predicate = this._predicate, object = this._object;
          if (!inversePredicate) this._emit(subject, predicate, object, graph);
          else this._emit(object, predicate, subject, graph);
        }
        return next;
      }
      // ### `_readBlankNodePunctuation` reads punctuation in a blank node
      _readBlankNodePunctuation(token) {
        let next;
        switch (token.type) {
          // Semicolon means the subject is shared; predicate and object are different
          case ";":
            next = this._readPredicate;
            break;
          // Comma means both the subject and predicate are shared; the object is different
          case ",":
            next = this._readObject;
            break;
          default:
            return this._error(`Expected punctuation to follow "${this._object.id}"`, token);
        }
        this._emit(this._subject, this._predicate, this._object, this._graph);
        return next;
      }
      // ### `_readQuadPunctuation` reads punctuation after a quad
      _readQuadPunctuation(token) {
        if (token.type !== ".") return this._error("Expected dot to follow quad", token);
        return this._readInTopContext;
      }
      // ### `_readPrefix` reads the prefix of a prefix declaration
      _readPrefix(token) {
        if (token.type !== "prefix") return this._error("Expected prefix to follow @prefix", token);
        this._prefix = token.value;
        return this._readPrefixIRI;
      }
      // ### `_readPrefixIRI` reads the IRI of a prefix declaration
      _readPrefixIRI(token) {
        if (token.type !== "IRI") return this._error(`Expected IRI to follow prefix "${this._prefix}:"`, token);
        const prefixNode = this._readEntity(token);
        this._prefixes[this._prefix] = prefixNode.value;
        this._prefixCallback(this._prefix, prefixNode);
        return this._readDeclarationPunctuation;
      }
      // ### `_readBaseIRI` reads the IRI of a base declaration
      _readBaseIRI(token) {
        const iri = token.type === "IRI" && this._resolveIRI(token.value);
        if (!iri) return this._error("Expected valid IRI to follow base declaration", token);
        this._setBase(iri);
        return this._readDeclarationPunctuation;
      }
      // ### `_readNamedGraphLabel` reads the label of a named graph
      _readNamedGraphLabel(token) {
        switch (token.type) {
          case "IRI":
          case "blank":
          case "prefixed":
            return this._readSubject(token), this._readGraph;
          case "[":
            return this._readNamedGraphBlankLabel;
          default:
            return this._error("Invalid graph label", token);
        }
      }
      // ### `_readNamedGraphLabel` reads a blank node label of a named graph
      _readNamedGraphBlankLabel(token) {
        if (token.type !== "]") return this._error("Invalid graph label", token);
        this._subject = this._factory.blankNode();
        return this._readGraph;
      }
      // ### `_readDeclarationPunctuation` reads the punctuation of a declaration
      _readDeclarationPunctuation(token) {
        if (this._sparqlStyle) {
          this._sparqlStyle = false;
          return this._readInTopContext(token);
        }
        if (token.type !== ".") return this._error("Expected declaration to end with a dot", token);
        return this._readInTopContext;
      }
      // Reads a list of quantified symbols from a @forSome or @forAll statement
      _readQuantifierList(token) {
        let entity;
        switch (token.type) {
          case "IRI":
          case "prefixed":
            if ((entity = this._readEntity(token, true)) !== void 0) break;
          default:
            return this._error(`Unexpected ${token.type}`, token);
        }
        if (!this._explicitQuantifiers) this._quantified[entity.id] = this._factory[this._quantifier](this._factory.blankNode().value);
        else {
          if (this._subject === null) this._emit(this._graph || this.DEFAULTGRAPH, this._predicate, this._subject = this._factory.blankNode(), this.QUANTIFIERS_GRAPH);
          else this._emit(this._subject, this.RDF_REST, this._subject = this._factory.blankNode(), this.QUANTIFIERS_GRAPH);
          this._emit(this._subject, this.RDF_FIRST, entity, this.QUANTIFIERS_GRAPH);
        }
        return this._readQuantifierPunctuation;
      }
      // Reads punctuation from a @forSome or @forAll statement
      _readQuantifierPunctuation(token) {
        if (token.type === ",") return this._readQuantifierList;
        else {
          if (this._explicitQuantifiers) {
            this._emit(this._subject, this.RDF_REST, this.RDF_NIL, this.QUANTIFIERS_GRAPH);
            this._subject = null;
          }
          this._readCallback = this._getContextEndReader();
          return this._readCallback(token);
        }
      }
      // ### `_getPathReader` reads a potential path and then resumes with the given function
      _getPathReader(afterPath) {
        this._afterPath = afterPath;
        return this._readPath;
      }
      // ### `_readPath` reads a potential path
      _readPath(token) {
        switch (token.type) {
          // Forward path
          case "!":
            return this._readForwardPath;
          // Backward path
          case "^":
            return this._readBackwardPath;
          // Not a path; resume reading where we left off
          default:
            const stack = this._contextStack, parent = stack.length && stack[stack.length - 1];
            if (parent && parent.type === "item") {
              const item = this._subject;
              this._restoreContext("item", token);
              this._emit(this._subject, this.RDF_FIRST, item, this._graph);
            }
            return this._afterPath(token);
        }
      }
      // ### `_readForwardPath` reads a '!' path
      _readForwardPath(token) {
        let subject, predicate;
        const object = this._factory.blankNode();
        if ((predicate = this._readEntity(token)) === void 0) return;
        if (this._predicate === null) subject = this._subject, this._subject = object;
        else subject = this._object, this._object = object;
        this._emit(subject, predicate, object, this._graph);
        return this._readPath;
      }
      // ### `_readBackwardPath` reads a '^' path
      _readBackwardPath(token) {
        const subject = this._factory.blankNode();
        let predicate, object;
        if ((predicate = this._readEntity(token)) === void 0) return;
        if (this._predicate === null) object = this._subject, this._subject = subject;
        else object = this._object, this._object = subject;
        this._emit(subject, predicate, object, this._graph);
        return this._readPath;
      }
      // ### `_readRDFStarTailOrGraph` reads the graph of a nested RDF-star quad or the end of a nested RDF-star triple
      _readRDFStarTailOrGraph(token) {
        if (token.type !== ">>") {
          if (this._supportsQuads && this._graph === null && (this._graph = this._readEntity(token)) !== void 0) return this._readRDFStarTail;
          return this._error(`Expected >> to follow "${this._object.id}"`, token);
        }
        return this._readRDFStarTail(token);
      }
      // ### `_readRDFStarTail` reads the end of a nested RDF-star triple
      _readRDFStarTail(token) {
        if (token.type !== ">>") return this._error(`Expected >> but got ${token.type}`, token);
        const quad2 = this._factory.quad(this._subject, this._predicate, this._object, this._graph || this.DEFAULTGRAPH);
        this._restoreContext("<<", token);
        if (this._subject === null) {
          this._subject = quad2;
          return this._readPredicate;
        } else {
          this._object = quad2;
          return this._getContextEndReader();
        }
      }
      // ### `_getContextEndReader` gets the next reader function at the end of a context
      _getContextEndReader() {
        const contextStack = this._contextStack;
        if (!contextStack.length) return this._readPunctuation;
        switch (contextStack[contextStack.length - 1].type) {
          case "blank":
            return this._readBlankNodeTail;
          case "list":
            return this._readListItem;
          case "formula":
            return this._readFormulaTail;
          case "<<":
            return this._readRDFStarTailOrGraph;
        }
      }
      // ### `_emit` sends a quad through the callback
      _emit(subject, predicate, object, graph) {
        this._callback(null, this._factory.quad(subject, predicate, object, graph || this.DEFAULTGRAPH));
      }
      // ### `_error` emits an error message through the callback
      _error(message, token) {
        const err2 = new Error(`${message} on line ${token.line}.`);
        err2.context = {
          token,
          line: token.line,
          previousToken: this._lexer.previousToken
        };
        this._callback(err2);
        this._callback = noop;
      }
      // ### `_resolveIRI` resolves an IRI against the base path
      _resolveIRI(iri) {
        return /^[a-z][a-z0-9+.-]*:/i.test(iri) ? iri : this._resolveRelativeIRI(iri);
      }
      // ### `_resolveRelativeIRI` resolves an IRI against the base path,
      // assuming that a base path has been set and that the IRI is indeed relative
      _resolveRelativeIRI(iri) {
        if (!iri.length) return this._base;
        switch (iri[0]) {
          // Resolve relative fragment IRIs against the base IRI
          case "#":
            return this._base + iri;
          // Resolve relative query string IRIs by replacing the query string
          case "?":
            return this._base.replace(/(?:\?.*)?$/, iri);
          // Resolve root-relative IRIs at the root of the base IRI
          case "/":
            return (iri[1] === "/" ? this._baseScheme : this._baseRoot) + this._removeDotSegments(iri);
          // Resolve all other IRIs at the base IRI's path
          default:
            return /^[^/:]*:/.test(iri) ? null : this._removeDotSegments(this._basePath + iri);
        }
      }
      // ### `_removeDotSegments` resolves './' and '../' path segments in an IRI as per RFC3986
      _removeDotSegments(iri) {
        if (!/(^|\/)\.\.?($|[/#?])/.test(iri)) return iri;
        const length = iri.length;
        let result = "", i = -1, pathStart = -1, segmentStart = 0, next = "/";
        while (i < length) {
          switch (next) {
            // The path starts with the first slash after the authority
            case ":":
              if (pathStart < 0) {
                if (iri[++i] === "/" && iri[++i] === "/")
                  while ((pathStart = i + 1) < length && iri[pathStart] !== "/") i = pathStart;
              }
              break;
            // Don't modify a query string or fragment
            case "?":
            case "#":
              i = length;
              break;
            // Handle '/.' or '/..' path segments
            case "/":
              if (iri[i + 1] === ".") {
                next = iri[++i + 1];
                switch (next) {
                  // Remove a '/.' segment
                  case "/":
                    result += iri.substring(segmentStart, i - 1);
                    segmentStart = i + 1;
                    break;
                  // Remove a trailing '/.' segment
                  case void 0:
                  case "?":
                  case "#":
                    return result + iri.substring(segmentStart, i) + iri.substr(i + 1);
                  // Remove a '/..' segment
                  case ".":
                    next = iri[++i + 1];
                    if (next === void 0 || next === "/" || next === "?" || next === "#") {
                      result += iri.substring(segmentStart, i - 2);
                      if ((segmentStart = result.lastIndexOf("/")) >= pathStart) result = result.substr(0, segmentStart);
                      if (next !== "/") return `${result}/${iri.substr(i + 1)}`;
                      segmentStart = i + 1;
                    }
                }
              }
          }
          next = iri[++i];
        }
        return result + iri.substring(segmentStart);
      }
      // ## Public methods
      // ### `parse` parses the N3 input and emits each parsed quad through the onQuad callback.
      parse(input, quadCallback, prefixCallback) {
        let onQuad, onPrefix, onComment;
        if (quadCallback && (quadCallback.onQuad || quadCallback.onPrefix || quadCallback.onComment)) {
          onQuad = quadCallback.onQuad;
          onPrefix = quadCallback.onPrefix;
          onComment = quadCallback.onComment;
        } else {
          onQuad = quadCallback;
          onPrefix = prefixCallback;
        }
        this._readCallback = this._readInTopContext;
        this._sparqlStyle = false;
        this._prefixes = /* @__PURE__ */ Object.create(null);
        this._prefixes._ = this._blankNodePrefix ? this._blankNodePrefix.substr(2) : `b${blankNodePrefix++}_`;
        this._prefixCallback = onPrefix || noop;
        this._inversePredicate = false;
        this._quantified = /* @__PURE__ */ Object.create(null);
        if (!onQuad) {
          const quads = [];
          let error2;
          this._callback = (e, t) => {
            e ? error2 = e : t && quads.push(t);
          };
          this._lexer.tokenize(input).every((token) => {
            return this._readCallback = this._readCallback(token);
          });
          if (error2) throw error2;
          return quads;
        }
        let processNextToken = (error2, token) => {
          if (error2 !== null) this._callback(error2), this._callback = noop;
          else if (this._readCallback) this._readCallback = this._readCallback(token);
        };
        if (onComment) {
          this._lexer.comments = true;
          processNextToken = (error2, token) => {
            if (error2 !== null) this._callback(error2), this._callback = noop;
            else if (this._readCallback) {
              if (token.type === "comment") onComment(token.value);
              else this._readCallback = this._readCallback(token);
            }
          };
        }
        this._callback = onQuad;
        this._lexer.tokenize(input, processNextToken);
      }
    };
    exports.default = N3Parser;
    function noop() {
    }
    function initDataFactory(parser, factory3) {
      parser._factory = factory3;
      parser.DEFAULTGRAPH = factory3.defaultGraph();
      parser.RDF_FIRST = factory3.namedNode(_IRIs.default.rdf.first);
      parser.RDF_REST = factory3.namedNode(_IRIs.default.rdf.rest);
      parser.RDF_NIL = factory3.namedNode(_IRIs.default.rdf.nil);
      parser.N3_FORALL = factory3.namedNode(_IRIs.default.r.forAll);
      parser.N3_FORSOME = factory3.namedNode(_IRIs.default.r.forSome);
      parser.ABBREVIATIONS = {
        "a": factory3.namedNode(_IRIs.default.rdf.type),
        "=": factory3.namedNode(_IRIs.default.owl.sameAs),
        ">": factory3.namedNode(_IRIs.default.log.implies),
        "<": factory3.namedNode(_IRIs.default.log.isImpliedBy)
      };
      parser.QUANTIFIERS_GRAPH = factory3.namedNode("urn:n3:quantifiers");
    }
    initDataFactory(N3Parser.prototype, _N3DataFactory.default);
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Util.js
var require_N3Util = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.inDefaultGraph = inDefaultGraph;
    exports.isBlankNode = isBlankNode;
    exports.isDefaultGraph = isDefaultGraph;
    exports.isLiteral = isLiteral;
    exports.isNamedNode = isNamedNode;
    exports.isQuad = isQuad;
    exports.isVariable = isVariable;
    exports.prefix = prefix;
    exports.prefixes = prefixes;
    var _N3DataFactory = _interopRequireDefault(require_N3DataFactory());
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : { default: e };
    }
    function isNamedNode(term2) {
      return !!term2 && term2.termType === "NamedNode";
    }
    function isBlankNode(term2) {
      return !!term2 && term2.termType === "BlankNode";
    }
    function isLiteral(term2) {
      return !!term2 && term2.termType === "Literal";
    }
    function isVariable(term2) {
      return !!term2 && term2.termType === "Variable";
    }
    function isQuad(term2) {
      return !!term2 && term2.termType === "Quad";
    }
    function isDefaultGraph(term2) {
      return !!term2 && term2.termType === "DefaultGraph";
    }
    function inDefaultGraph(quad2) {
      return isDefaultGraph(quad2.graph);
    }
    function prefix(iri, factory3) {
      return prefixes({
        "": iri.value || iri
      }, factory3)("");
    }
    function prefixes(defaultPrefixes, factory3) {
      const prefixes2 = /* @__PURE__ */ Object.create(null);
      for (const prefix2 in defaultPrefixes) processPrefix(prefix2, defaultPrefixes[prefix2]);
      factory3 = factory3 || _N3DataFactory.default;
      function processPrefix(prefix2, iri) {
        if (typeof iri === "string") {
          const cache = /* @__PURE__ */ Object.create(null);
          prefixes2[prefix2] = (local) => {
            return cache[local] || (cache[local] = factory3.namedNode(iri + local));
          };
        } else if (!(prefix2 in prefixes2)) {
          throw new Error(`Unknown prefix: ${prefix2}`);
        }
        return prefixes2[prefix2];
      }
      return processPrefix;
    }
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/Util.js
var require_Util = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/Util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.escapeRegex = escapeRegex;
    function escapeRegex(regex) {
      return regex.replace(/[\]\/\(\)\*\+\?\.\\\$]/g, "\\$&");
    }
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/BaseIRI.js
var require_BaseIRI = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/BaseIRI.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _Util = require_Util();
    var BASE_UNSUPPORTED = /^:?[^:?#]*(?:[?#]|$)|^file:|^[^:]*:\/*[^?#]+?\/(?:\.\.?(?:\/|$)|\/)/i;
    var SUFFIX_SUPPORTED = /^(?:(?:[^/?#]{3,}|\.?[^/?#.]\.?)(?:\/[^/?#]{3,}|\.?[^/?#.]\.?)*\/?)?(?:[?#]|$)/;
    var CURRENT = "./";
    var PARENT = "../";
    var QUERY = "?";
    var FRAGMENT = "#";
    var BaseIRI = class _BaseIRI {
      constructor(base) {
        this.base = base;
        this._baseLength = 0;
        this._baseMatcher = null;
        this._pathReplacements = new Array(base.length + 1);
      }
      static supports(base) {
        return !BASE_UNSUPPORTED.test(base);
      }
      _getBaseMatcher() {
        if (this._baseMatcher) return this._baseMatcher;
        if (!_BaseIRI.supports(this.base)) return this._baseMatcher = /.^/;
        const scheme = /^[^:]*:\/*/.exec(this.base)[0];
        const regexHead = ["^", (0, _Util.escapeRegex)(scheme)];
        const regexTail = [];
        const segments = [], segmenter = /[^/?#]*([/?#])/y;
        let segment, query = 0, fragment = 0, last = segmenter.lastIndex = scheme.length;
        while (!query && !fragment && (segment = segmenter.exec(this.base))) {
          if (segment[1] === FRAGMENT) fragment = segmenter.lastIndex - 1;
          else {
            regexHead.push((0, _Util.escapeRegex)(segment[0]), "(?:");
            regexTail.push(")?");
            if (segment[1] !== QUERY) segments.push(last = segmenter.lastIndex);
            else {
              query = last = segmenter.lastIndex;
              fragment = this.base.indexOf(FRAGMENT, query);
              this._pathReplacements[query] = QUERY;
            }
          }
        }
        for (let i = 0; i < segments.length; i++) this._pathReplacements[segments[i]] = PARENT.repeat(segments.length - i - 1);
        this._pathReplacements[segments[segments.length - 1]] = CURRENT;
        this._baseLength = fragment > 0 ? fragment : this.base.length;
        regexHead.push((0, _Util.escapeRegex)(this.base.substring(last, this._baseLength)), query ? "(?:#|$)" : "(?:[?#]|$)");
        return this._baseMatcher = new RegExp([...regexHead, ...regexTail].join(""));
      }
      toRelative(iri) {
        const match = this._getBaseMatcher().exec(iri);
        if (!match) return iri;
        const length = match[0].length;
        if (length === this._baseLength && length === iri.length) return "";
        const parentPath = this._pathReplacements[length];
        if (parentPath) {
          const suffix = iri.substring(length);
          if (parentPath !== QUERY && !SUFFIX_SUPPORTED.test(suffix)) return iri;
          if (parentPath === CURRENT && /^[^?#]/.test(suffix)) return suffix;
          return parentPath + suffix;
        }
        return iri.substring(length - 1);
      }
    };
    exports.default = BaseIRI;
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Writer.js
var require_N3Writer = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Writer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _IRIs = _interopRequireDefault(require_IRIs());
    var _N3DataFactory = _interopRequireWildcard(require_N3DataFactory());
    var _N3Util = require_N3Util();
    var _BaseIRI = _interopRequireDefault(require_BaseIRI());
    var _Util = require_Util();
    function _interopRequireWildcard(e, t) {
      if ("function" == typeof WeakMap) var r = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap();
      return (_interopRequireWildcard = function(e2, t2) {
        if (!t2 && e2 && e2.__esModule) return e2;
        var o, i, f = { __proto__: null, default: e2 };
        if (null === e2 || "object" != typeof e2 && "function" != typeof e2) return f;
        if (o = t2 ? n : r) {
          if (o.has(e2)) return o.get(e2);
          o.set(e2, f);
        }
        for (const t3 in e2) "default" !== t3 && {}.hasOwnProperty.call(e2, t3) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e2, t3)) && (i.get || i.set) ? o(f, t3, i) : f[t3] = e2[t3]);
        return f;
      })(e, t);
    }
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : { default: e };
    }
    var DEFAULTGRAPH = _N3DataFactory.default.defaultGraph();
    var {
      rdf,
      xsd: xsd2
    } = _IRIs.default;
    var escape = /["\\\t\n\r\b\f\u0000-\u0019\ud800-\udbff]/;
    var escapeAll = /["\\\t\n\r\b\f\u0000-\u0019]|[\ud800-\udbff][\udc00-\udfff]/g;
    var escapedCharacters = {
      "\\": "\\\\",
      '"': '\\"',
      "	": "\\t",
      "\n": "\\n",
      "\r": "\\r",
      "\b": "\\b",
      "\f": "\\f"
    };
    var SerializedTerm = class extends _N3DataFactory.Term {
      // Pretty-printed nodes are not equal to any other node
      // (e.g., [] does not equal [])
      equals(other) {
        return other === this;
      }
    };
    var N3Writer = class {
      constructor(outputStream, options) {
        this._prefixRegex = /$0^/;
        if (outputStream && typeof outputStream.write !== "function") options = outputStream, outputStream = null;
        options = options || {};
        this._lists = options.lists;
        if (!outputStream) {
          let output = "";
          this._outputStream = {
            write(chunk, encoding, done) {
              output += chunk;
              done && done();
            },
            end: (done) => {
              done && done(null, output);
            }
          };
          this._endStream = true;
        } else {
          this._outputStream = outputStream;
          this._endStream = options.end === void 0 ? true : !!options.end;
        }
        this._subject = null;
        if (!/triple|quad/i.test(options.format)) {
          this._lineMode = false;
          this._graph = DEFAULTGRAPH;
          this._prefixIRIs = /* @__PURE__ */ Object.create(null);
          options.prefixes && this.addPrefixes(options.prefixes);
          if (options.baseIRI) {
            this._baseIri = new _BaseIRI.default(options.baseIRI);
          }
        } else {
          this._lineMode = true;
          this._writeQuad = this._writeQuadLine;
        }
      }
      // ## Private methods
      // ### Whether the current graph is the default graph
      get _inDefaultGraph() {
        return DEFAULTGRAPH.equals(this._graph);
      }
      // ### `_write` writes the argument to the output stream
      _write(string, callback) {
        this._outputStream.write(string, "utf8", callback);
      }
      // ### `_writeQuad` writes the quad to the output stream
      _writeQuad(subject, predicate, object, graph, done) {
        try {
          if (!graph.equals(this._graph)) {
            this._write((this._subject === null ? "" : this._inDefaultGraph ? ".\n" : "\n}\n") + (DEFAULTGRAPH.equals(graph) ? "" : `${this._encodeIriOrBlank(graph)} {
`));
            this._graph = graph;
            this._subject = null;
          }
          if (subject.equals(this._subject)) {
            if (predicate.equals(this._predicate)) this._write(`, ${this._encodeObject(object)}`, done);
            else this._write(`;
    ${this._encodePredicate(this._predicate = predicate)} ${this._encodeObject(object)}`, done);
          } else this._write(`${(this._subject === null ? "" : ".\n") + this._encodeSubject(this._subject = subject)} ${this._encodePredicate(this._predicate = predicate)} ${this._encodeObject(object)}`, done);
        } catch (error2) {
          done && done(error2);
        }
      }
      // ### `_writeQuadLine` writes the quad to the output stream as a single line
      _writeQuadLine(subject, predicate, object, graph, done) {
        delete this._prefixMatch;
        this._write(this.quadToString(subject, predicate, object, graph), done);
      }
      // ### `quadToString` serializes a quad as a string
      quadToString(subject, predicate, object, graph) {
        return `${this._encodeSubject(subject)} ${this._encodeIriOrBlank(predicate)} ${this._encodeObject(object)}${graph && graph.value ? ` ${this._encodeIriOrBlank(graph)} .
` : " .\n"}`;
      }
      // ### `quadsToString` serializes an array of quads as a string
      quadsToString(quads) {
        let quadsString = "";
        for (const quad2 of quads) quadsString += this.quadToString(quad2.subject, quad2.predicate, quad2.object, quad2.graph);
        return quadsString;
      }
      // ### `_encodeSubject` represents a subject
      _encodeSubject(entity) {
        return entity.termType === "Quad" ? this._encodeQuad(entity) : this._encodeIriOrBlank(entity);
      }
      // ### `_encodeIriOrBlank` represents an IRI or blank node
      _encodeIriOrBlank(entity) {
        if (entity.termType !== "NamedNode") {
          if (this._lists && entity.value in this._lists) entity = this.list(this._lists[entity.value]);
          return "id" in entity ? entity.id : `_:${entity.value}`;
        }
        let iri = entity.value;
        if (this._baseIri) {
          iri = this._baseIri.toRelative(iri);
        }
        if (escape.test(iri)) iri = iri.replace(escapeAll, characterReplacer);
        const prefixMatch = this._prefixRegex.exec(iri);
        return !prefixMatch ? `<${iri}>` : !prefixMatch[1] ? iri : this._prefixIRIs[prefixMatch[1]] + prefixMatch[2];
      }
      // ### `_encodeLiteral` represents a literal
      _encodeLiteral(literal3) {
        let value = literal3.value;
        if (escape.test(value)) value = value.replace(escapeAll, characterReplacer);
        if (literal3.language) return `"${value}"@${literal3.language}`;
        if (this._lineMode) {
          if (literal3.datatype.value === xsd2.string) return `"${value}"`;
        } else {
          switch (literal3.datatype.value) {
            case xsd2.string:
              return `"${value}"`;
            case xsd2.boolean:
              if (value === "true" || value === "false") return value;
              break;
            case xsd2.integer:
              if (/^[+-]?\d+$/.test(value)) return value;
              break;
            case xsd2.decimal:
              if (/^[+-]?\d*\.\d+$/.test(value)) return value;
              break;
            case xsd2.double:
              if (/^[+-]?(?:\d+\.\d*|\.?\d+)[eE][+-]?\d+$/.test(value)) return value;
              break;
          }
        }
        return `"${value}"^^${this._encodeIriOrBlank(literal3.datatype)}`;
      }
      // ### `_encodePredicate` represents a predicate
      _encodePredicate(predicate) {
        return predicate.value === rdf.type ? "a" : this._encodeIriOrBlank(predicate);
      }
      // ### `_encodeObject` represents an object
      _encodeObject(object) {
        switch (object.termType) {
          case "Quad":
            return this._encodeQuad(object);
          case "Literal":
            return this._encodeLiteral(object);
          default:
            return this._encodeIriOrBlank(object);
        }
      }
      // ### `_encodeQuad` encodes an RDF-star quad
      _encodeQuad({
        subject,
        predicate,
        object,
        graph
      }) {
        return `<<${this._encodeSubject(subject)} ${this._encodePredicate(predicate)} ${this._encodeObject(object)}${(0, _N3Util.isDefaultGraph)(graph) ? "" : ` ${this._encodeIriOrBlank(graph)}`}>>`;
      }
      // ### `_blockedWrite` replaces `_write` after the writer has been closed
      _blockedWrite() {
        throw new Error("Cannot write because the writer has been closed.");
      }
      // ### `addQuad` adds the quad to the output stream
      addQuad(subject, predicate, object, graph, done) {
        if (object === void 0) this._writeQuad(subject.subject, subject.predicate, subject.object, subject.graph, predicate);
        else if (typeof graph === "function") this._writeQuad(subject, predicate, object, DEFAULTGRAPH, graph);
        else this._writeQuad(subject, predicate, object, graph || DEFAULTGRAPH, done);
      }
      // ### `addQuads` adds the quads to the output stream
      addQuads(quads) {
        for (let i = 0; i < quads.length; i++) this.addQuad(quads[i]);
      }
      // ### `addPrefix` adds the prefix to the output stream
      addPrefix(prefix, iri, done) {
        const prefixes = {};
        prefixes[prefix] = iri;
        this.addPrefixes(prefixes, done);
      }
      // ### `addPrefixes` adds the prefixes to the output stream
      addPrefixes(prefixes, done) {
        if (!this._prefixIRIs) return done && done();
        let hasPrefixes = false;
        for (let prefix in prefixes) {
          let iri = prefixes[prefix];
          if (typeof iri !== "string") iri = iri.value;
          hasPrefixes = true;
          if (this._subject !== null) {
            this._write(this._inDefaultGraph ? ".\n" : "\n}\n");
            this._subject = null, this._graph = "";
          }
          this._prefixIRIs[iri] = prefix += ":";
          this._write(`@prefix ${prefix} <${iri}>.
`);
        }
        if (hasPrefixes) {
          let IRIlist = "", prefixList = "";
          for (const prefixIRI in this._prefixIRIs) {
            IRIlist += IRIlist ? `|${prefixIRI}` : prefixIRI;
            prefixList += (prefixList ? "|" : "") + this._prefixIRIs[prefixIRI];
          }
          IRIlist = (0, _Util.escapeRegex)(IRIlist, /[\]\/\(\)\*\+\?\.\\\$]/g, "\\$&");
          this._prefixRegex = new RegExp(`^(?:${prefixList})[^/]*$|^(${IRIlist})([_a-zA-Z0-9][\\-_a-zA-Z0-9]*)$`);
        }
        this._write(hasPrefixes ? "\n" : "", done);
      }
      // ### `blank` creates a blank node with the given content
      blank(predicate, object) {
        let children = predicate, child, length;
        if (predicate === void 0) children = [];
        else if (predicate.termType) children = [{
          predicate,
          object
        }];
        else if (!("length" in predicate)) children = [predicate];
        switch (length = children.length) {
          // Generate an empty blank node
          case 0:
            return new SerializedTerm("[]");
          // Generate a non-nested one-triple blank node
          case 1:
            child = children[0];
            if (!(child.object instanceof SerializedTerm)) return new SerializedTerm(`[ ${this._encodePredicate(child.predicate)} ${this._encodeObject(child.object)} ]`);
          // Generate a multi-triple or nested blank node
          default:
            let contents = "[";
            for (let i = 0; i < length; i++) {
              child = children[i];
              if (child.predicate.equals(predicate)) contents += `, ${this._encodeObject(child.object)}`;
              else {
                contents += `${(i ? ";\n  " : "\n  ") + this._encodePredicate(child.predicate)} ${this._encodeObject(child.object)}`;
                predicate = child.predicate;
              }
            }
            return new SerializedTerm(`${contents}
]`);
        }
      }
      // ### `list` creates a list node with the given content
      list(elements) {
        const length = elements && elements.length || 0, contents = new Array(length);
        for (let i = 0; i < length; i++) contents[i] = this._encodeObject(elements[i]);
        return new SerializedTerm(`(${contents.join(" ")})`);
      }
      // ### `end` signals the end of the output stream
      end(done) {
        if (this._subject !== null) {
          this._write(this._inDefaultGraph ? ".\n" : "\n}\n");
          this._subject = null;
        }
        this._write = this._blockedWrite;
        let singleDone = done && ((error2, result) => {
          singleDone = null, done(error2, result);
        });
        if (this._endStream) {
          try {
            return this._outputStream.end(singleDone);
          } catch (error2) {
          }
        }
        singleDone && singleDone();
      }
    };
    exports.default = N3Writer;
    function characterReplacer(character) {
      let result = escapedCharacters[character];
      if (result === void 0) {
        if (character.length === 1) {
          result = character.charCodeAt(0).toString(16);
          result = "\\u0000".substr(0, 6 - result.length) + result;
        } else {
          result = ((character.charCodeAt(0) - 55296) * 1024 + character.charCodeAt(1) + 9216).toString(16);
          result = "\\U00000000".substr(0, 10 - result.length) + result;
        }
      }
      return result;
    }
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/ours/primordials.js
var require_primordials = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/ours/primordials.js"(exports, module) {
    "use strict";
    var AggregateError = class extends Error {
      constructor(errors) {
        if (!Array.isArray(errors)) {
          throw new TypeError(`Expected input to be an Array, got ${typeof errors}`);
        }
        let message = "";
        for (let i = 0; i < errors.length; i++) {
          message += `    ${errors[i].stack}
`;
        }
        super(message);
        this.name = "AggregateError";
        this.errors = errors;
      }
    };
    module.exports = {
      AggregateError,
      ArrayIsArray(self) {
        return Array.isArray(self);
      },
      ArrayPrototypeIncludes(self, el) {
        return self.includes(el);
      },
      ArrayPrototypeIndexOf(self, el) {
        return self.indexOf(el);
      },
      ArrayPrototypeJoin(self, sep) {
        return self.join(sep);
      },
      ArrayPrototypeMap(self, fn) {
        return self.map(fn);
      },
      ArrayPrototypePop(self, el) {
        return self.pop(el);
      },
      ArrayPrototypePush(self, el) {
        return self.push(el);
      },
      ArrayPrototypeSlice(self, start, end) {
        return self.slice(start, end);
      },
      Error,
      FunctionPrototypeCall(fn, thisArgs, ...args) {
        return fn.call(thisArgs, ...args);
      },
      FunctionPrototypeSymbolHasInstance(self, instance) {
        return Function.prototype[Symbol.hasInstance].call(self, instance);
      },
      MathFloor: Math.floor,
      Number,
      NumberIsInteger: Number.isInteger,
      NumberIsNaN: Number.isNaN,
      NumberMAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER,
      NumberMIN_SAFE_INTEGER: Number.MIN_SAFE_INTEGER,
      NumberParseInt: Number.parseInt,
      ObjectDefineProperties(self, props) {
        return Object.defineProperties(self, props);
      },
      ObjectDefineProperty(self, name, prop) {
        return Object.defineProperty(self, name, prop);
      },
      ObjectGetOwnPropertyDescriptor(self, name) {
        return Object.getOwnPropertyDescriptor(self, name);
      },
      ObjectKeys(obj) {
        return Object.keys(obj);
      },
      ObjectSetPrototypeOf(target, proto) {
        return Object.setPrototypeOf(target, proto);
      },
      Promise,
      PromisePrototypeCatch(self, fn) {
        return self.catch(fn);
      },
      PromisePrototypeThen(self, thenFn, catchFn) {
        return self.then(thenFn, catchFn);
      },
      PromiseReject(err2) {
        return Promise.reject(err2);
      },
      PromiseResolve(val) {
        return Promise.resolve(val);
      },
      ReflectApply: Reflect.apply,
      RegExpPrototypeTest(self, value) {
        return self.test(value);
      },
      SafeSet: Set,
      String,
      StringPrototypeSlice(self, start, end) {
        return self.slice(start, end);
      },
      StringPrototypeToLowerCase(self) {
        return self.toLowerCase();
      },
      StringPrototypeToUpperCase(self) {
        return self.toUpperCase();
      },
      StringPrototypeTrim(self) {
        return self.trim();
      },
      Symbol,
      SymbolFor: Symbol.for,
      SymbolAsyncIterator: Symbol.asyncIterator,
      SymbolHasInstance: Symbol.hasInstance,
      SymbolIterator: Symbol.iterator,
      SymbolDispose: Symbol.dispose || /* @__PURE__ */ Symbol("Symbol.dispose"),
      SymbolAsyncDispose: Symbol.asyncDispose || /* @__PURE__ */ Symbol("Symbol.asyncDispose"),
      TypedArrayPrototypeSet(self, buf, len) {
        return self.set(buf, len);
      },
      Boolean,
      Uint8Array
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/ours/util/inspect.js
var require_inspect = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/ours/util/inspect.js"(exports, module) {
    "use strict";
    module.exports = {
      format(format, ...args) {
        return format.replace(/%([sdifj])/g, function(...[_unused, type]) {
          const replacement = args.shift();
          if (type === "f") {
            return replacement.toFixed(6);
          } else if (type === "j") {
            return JSON.stringify(replacement);
          } else if (type === "s" && typeof replacement === "object") {
            const ctor = replacement.constructor !== Object ? replacement.constructor.name : "";
            return `${ctor} {}`.trim();
          } else {
            return replacement.toString();
          }
        });
      },
      inspect(value) {
        switch (typeof value) {
          case "string":
            if (value.includes("'")) {
              if (!value.includes('"')) {
                return `"${value}"`;
              } else if (!value.includes("`") && !value.includes("${")) {
                return `\`${value}\``;
              }
            }
            return `'${value}'`;
          case "number":
            if (isNaN(value)) {
              return "NaN";
            } else if (Object.is(value, -0)) {
              return String(value);
            }
            return value;
          case "bigint":
            return `${String(value)}n`;
          case "boolean":
          case "undefined":
            return String(value);
          case "object":
            return "{}";
        }
      }
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/ours/errors.js
var require_errors = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/ours/errors.js"(exports, module) {
    "use strict";
    var { format, inspect } = require_inspect();
    var { AggregateError: CustomAggregateError } = require_primordials();
    var AggregateError = globalThis.AggregateError || CustomAggregateError;
    var kIsNodeError = /* @__PURE__ */ Symbol("kIsNodeError");
    var kTypes = [
      "string",
      "function",
      "number",
      "object",
      // Accept 'Function' and 'Object' as alternative to the lower cased version.
      "Function",
      "Object",
      "boolean",
      "bigint",
      "symbol"
    ];
    var classRegExp = /^([A-Z][a-z0-9]*)+$/;
    var nodeInternalPrefix = "__node_internal_";
    var codes = {};
    function assert(value, message) {
      if (!value) {
        throw new codes.ERR_INTERNAL_ASSERTION(message);
      }
    }
    function addNumericalSeparator(val) {
      let res = "";
      let i = val.length;
      const start = val[0] === "-" ? 1 : 0;
      for (; i >= start + 4; i -= 3) {
        res = `_${val.slice(i - 3, i)}${res}`;
      }
      return `${val.slice(0, i)}${res}`;
    }
    function getMessage(key, msg, args) {
      if (typeof msg === "function") {
        assert(
          msg.length <= args.length,
          // Default options do not count.
          `Code: ${key}; The provided arguments length (${args.length}) does not match the required ones (${msg.length}).`
        );
        return msg(...args);
      }
      const expectedLength = (msg.match(/%[dfijoOs]/g) || []).length;
      assert(
        expectedLength === args.length,
        `Code: ${key}; The provided arguments length (${args.length}) does not match the required ones (${expectedLength}).`
      );
      if (args.length === 0) {
        return msg;
      }
      return format(msg, ...args);
    }
    function E(code, message, Base) {
      if (!Base) {
        Base = Error;
      }
      class NodeError extends Base {
        constructor(...args) {
          super(getMessage(code, message, args));
        }
        toString() {
          return `${this.name} [${code}]: ${this.message}`;
        }
      }
      Object.defineProperties(NodeError.prototype, {
        name: {
          value: Base.name,
          writable: true,
          enumerable: false,
          configurable: true
        },
        toString: {
          value() {
            return `${this.name} [${code}]: ${this.message}`;
          },
          writable: true,
          enumerable: false,
          configurable: true
        }
      });
      NodeError.prototype.code = code;
      NodeError.prototype[kIsNodeError] = true;
      codes[code] = NodeError;
    }
    function hideStackFrames(fn) {
      const hidden = nodeInternalPrefix + fn.name;
      Object.defineProperty(fn, "name", {
        value: hidden
      });
      return fn;
    }
    function aggregateTwoErrors(innerError, outerError) {
      if (innerError && outerError && innerError !== outerError) {
        if (Array.isArray(outerError.errors)) {
          outerError.errors.push(innerError);
          return outerError;
        }
        const err2 = new AggregateError([outerError, innerError], outerError.message);
        err2.code = outerError.code;
        return err2;
      }
      return innerError || outerError;
    }
    var AbortError = class extends Error {
      constructor(message = "The operation was aborted", options = void 0) {
        if (options !== void 0 && typeof options !== "object") {
          throw new codes.ERR_INVALID_ARG_TYPE("options", "Object", options);
        }
        super(message, options);
        this.code = "ABORT_ERR";
        this.name = "AbortError";
      }
    };
    E("ERR_ASSERTION", "%s", Error);
    E(
      "ERR_INVALID_ARG_TYPE",
      (name, expected, actual) => {
        assert(typeof name === "string", "'name' must be a string");
        if (!Array.isArray(expected)) {
          expected = [expected];
        }
        let msg = "The ";
        if (name.endsWith(" argument")) {
          msg += `${name} `;
        } else {
          msg += `"${name}" ${name.includes(".") ? "property" : "argument"} `;
        }
        msg += "must be ";
        const types = [];
        const instances = [];
        const other = [];
        for (const value of expected) {
          assert(typeof value === "string", "All expected entries have to be of type string");
          if (kTypes.includes(value)) {
            types.push(value.toLowerCase());
          } else if (classRegExp.test(value)) {
            instances.push(value);
          } else {
            assert(value !== "object", 'The value "object" should be written as "Object"');
            other.push(value);
          }
        }
        if (instances.length > 0) {
          const pos = types.indexOf("object");
          if (pos !== -1) {
            types.splice(types, pos, 1);
            instances.push("Object");
          }
        }
        if (types.length > 0) {
          switch (types.length) {
            case 1:
              msg += `of type ${types[0]}`;
              break;
            case 2:
              msg += `one of type ${types[0]} or ${types[1]}`;
              break;
            default: {
              const last = types.pop();
              msg += `one of type ${types.join(", ")}, or ${last}`;
            }
          }
          if (instances.length > 0 || other.length > 0) {
            msg += " or ";
          }
        }
        if (instances.length > 0) {
          switch (instances.length) {
            case 1:
              msg += `an instance of ${instances[0]}`;
              break;
            case 2:
              msg += `an instance of ${instances[0]} or ${instances[1]}`;
              break;
            default: {
              const last = instances.pop();
              msg += `an instance of ${instances.join(", ")}, or ${last}`;
            }
          }
          if (other.length > 0) {
            msg += " or ";
          }
        }
        switch (other.length) {
          case 0:
            break;
          case 1:
            if (other[0].toLowerCase() !== other[0]) {
              msg += "an ";
            }
            msg += `${other[0]}`;
            break;
          case 2:
            msg += `one of ${other[0]} or ${other[1]}`;
            break;
          default: {
            const last = other.pop();
            msg += `one of ${other.join(", ")}, or ${last}`;
          }
        }
        if (actual == null) {
          msg += `. Received ${actual}`;
        } else if (typeof actual === "function" && actual.name) {
          msg += `. Received function ${actual.name}`;
        } else if (typeof actual === "object") {
          var _actual$constructor;
          if ((_actual$constructor = actual.constructor) !== null && _actual$constructor !== void 0 && _actual$constructor.name) {
            msg += `. Received an instance of ${actual.constructor.name}`;
          } else {
            const inspected = inspect(actual, {
              depth: -1
            });
            msg += `. Received ${inspected}`;
          }
        } else {
          let inspected = inspect(actual, {
            colors: false
          });
          if (inspected.length > 25) {
            inspected = `${inspected.slice(0, 25)}...`;
          }
          msg += `. Received type ${typeof actual} (${inspected})`;
        }
        return msg;
      },
      TypeError
    );
    E(
      "ERR_INVALID_ARG_VALUE",
      (name, value, reason = "is invalid") => {
        let inspected = inspect(value);
        if (inspected.length > 128) {
          inspected = inspected.slice(0, 128) + "...";
        }
        const type = name.includes(".") ? "property" : "argument";
        return `The ${type} '${name}' ${reason}. Received ${inspected}`;
      },
      TypeError
    );
    E(
      "ERR_INVALID_RETURN_VALUE",
      (input, name, value) => {
        var _value$constructor;
        const type = value !== null && value !== void 0 && (_value$constructor = value.constructor) !== null && _value$constructor !== void 0 && _value$constructor.name ? `instance of ${value.constructor.name}` : `type ${typeof value}`;
        return `Expected ${input} to be returned from the "${name}" function but got ${type}.`;
      },
      TypeError
    );
    E(
      "ERR_MISSING_ARGS",
      (...args) => {
        assert(args.length > 0, "At least one arg needs to be specified");
        let msg;
        const len = args.length;
        args = (Array.isArray(args) ? args : [args]).map((a) => `"${a}"`).join(" or ");
        switch (len) {
          case 1:
            msg += `The ${args[0]} argument`;
            break;
          case 2:
            msg += `The ${args[0]} and ${args[1]} arguments`;
            break;
          default:
            {
              const last = args.pop();
              msg += `The ${args.join(", ")}, and ${last} arguments`;
            }
            break;
        }
        return `${msg} must be specified`;
      },
      TypeError
    );
    E(
      "ERR_OUT_OF_RANGE",
      (str, range, input) => {
        assert(range, 'Missing "range" argument');
        let received;
        if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
          received = addNumericalSeparator(String(input));
        } else if (typeof input === "bigint") {
          received = String(input);
          const limit = BigInt(2) ** BigInt(32);
          if (input > limit || input < -limit) {
            received = addNumericalSeparator(received);
          }
          received += "n";
        } else {
          received = inspect(input);
        }
        return `The value of "${str}" is out of range. It must be ${range}. Received ${received}`;
      },
      RangeError
    );
    E("ERR_MULTIPLE_CALLBACK", "Callback called multiple times", Error);
    E("ERR_METHOD_NOT_IMPLEMENTED", "The %s method is not implemented", Error);
    E("ERR_STREAM_ALREADY_FINISHED", "Cannot call %s after a stream was finished", Error);
    E("ERR_STREAM_CANNOT_PIPE", "Cannot pipe, not readable", Error);
    E("ERR_STREAM_DESTROYED", "Cannot call %s after a stream was destroyed", Error);
    E("ERR_STREAM_NULL_VALUES", "May not write null values to stream", TypeError);
    E("ERR_STREAM_PREMATURE_CLOSE", "Premature close", Error);
    E("ERR_STREAM_PUSH_AFTER_EOF", "stream.push() after EOF", Error);
    E("ERR_STREAM_UNSHIFT_AFTER_END_EVENT", "stream.unshift() after end event", Error);
    E("ERR_STREAM_WRITE_AFTER_END", "write after end", Error);
    E("ERR_UNKNOWN_ENCODING", "Unknown encoding: %s", TypeError);
    module.exports = {
      AbortError,
      aggregateTwoErrors: hideStackFrames(aggregateTwoErrors),
      hideStackFrames,
      codes
    };
  }
});

// ../../node_modules/.pnpm/event-target-shim@5.0.1/node_modules/event-target-shim/dist/event-target-shim.js
var require_event_target_shim = __commonJS({
  "../../node_modules/.pnpm/event-target-shim@5.0.1/node_modules/event-target-shim/dist/event-target-shim.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var privateData = /* @__PURE__ */ new WeakMap();
    var wrappers = /* @__PURE__ */ new WeakMap();
    function pd(event) {
      const retv = privateData.get(event);
      console.assert(
        retv != null,
        "'this' is expected an Event object, but got",
        event
      );
      return retv;
    }
    function setCancelFlag(data) {
      if (data.passiveListener != null) {
        if (typeof console !== "undefined" && typeof console.error === "function") {
          console.error(
            "Unable to preventDefault inside passive event listener invocation.",
            data.passiveListener
          );
        }
        return;
      }
      if (!data.event.cancelable) {
        return;
      }
      data.canceled = true;
      if (typeof data.event.preventDefault === "function") {
        data.event.preventDefault();
      }
    }
    function Event(eventTarget, event) {
      privateData.set(this, {
        eventTarget,
        event,
        eventPhase: 2,
        currentTarget: eventTarget,
        canceled: false,
        stopped: false,
        immediateStopped: false,
        passiveListener: null,
        timeStamp: event.timeStamp || Date.now()
      });
      Object.defineProperty(this, "isTrusted", { value: false, enumerable: true });
      const keys = Object.keys(event);
      for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        if (!(key in this)) {
          Object.defineProperty(this, key, defineRedirectDescriptor(key));
        }
      }
    }
    Event.prototype = {
      /**
       * The type of this event.
       * @type {string}
       */
      get type() {
        return pd(this).event.type;
      },
      /**
       * The target of this event.
       * @type {EventTarget}
       */
      get target() {
        return pd(this).eventTarget;
      },
      /**
       * The target of this event.
       * @type {EventTarget}
       */
      get currentTarget() {
        return pd(this).currentTarget;
      },
      /**
       * @returns {EventTarget[]} The composed path of this event.
       */
      composedPath() {
        const currentTarget = pd(this).currentTarget;
        if (currentTarget == null) {
          return [];
        }
        return [currentTarget];
      },
      /**
       * Constant of NONE.
       * @type {number}
       */
      get NONE() {
        return 0;
      },
      /**
       * Constant of CAPTURING_PHASE.
       * @type {number}
       */
      get CAPTURING_PHASE() {
        return 1;
      },
      /**
       * Constant of AT_TARGET.
       * @type {number}
       */
      get AT_TARGET() {
        return 2;
      },
      /**
       * Constant of BUBBLING_PHASE.
       * @type {number}
       */
      get BUBBLING_PHASE() {
        return 3;
      },
      /**
       * The target of this event.
       * @type {number}
       */
      get eventPhase() {
        return pd(this).eventPhase;
      },
      /**
       * Stop event bubbling.
       * @returns {void}
       */
      stopPropagation() {
        const data = pd(this);
        data.stopped = true;
        if (typeof data.event.stopPropagation === "function") {
          data.event.stopPropagation();
        }
      },
      /**
       * Stop event bubbling.
       * @returns {void}
       */
      stopImmediatePropagation() {
        const data = pd(this);
        data.stopped = true;
        data.immediateStopped = true;
        if (typeof data.event.stopImmediatePropagation === "function") {
          data.event.stopImmediatePropagation();
        }
      },
      /**
       * The flag to be bubbling.
       * @type {boolean}
       */
      get bubbles() {
        return Boolean(pd(this).event.bubbles);
      },
      /**
       * The flag to be cancelable.
       * @type {boolean}
       */
      get cancelable() {
        return Boolean(pd(this).event.cancelable);
      },
      /**
       * Cancel this event.
       * @returns {void}
       */
      preventDefault() {
        setCancelFlag(pd(this));
      },
      /**
       * The flag to indicate cancellation state.
       * @type {boolean}
       */
      get defaultPrevented() {
        return pd(this).canceled;
      },
      /**
       * The flag to be composed.
       * @type {boolean}
       */
      get composed() {
        return Boolean(pd(this).event.composed);
      },
      /**
       * The unix time of this event.
       * @type {number}
       */
      get timeStamp() {
        return pd(this).timeStamp;
      },
      /**
       * The target of this event.
       * @type {EventTarget}
       * @deprecated
       */
      get srcElement() {
        return pd(this).eventTarget;
      },
      /**
       * The flag to stop event bubbling.
       * @type {boolean}
       * @deprecated
       */
      get cancelBubble() {
        return pd(this).stopped;
      },
      set cancelBubble(value) {
        if (!value) {
          return;
        }
        const data = pd(this);
        data.stopped = true;
        if (typeof data.event.cancelBubble === "boolean") {
          data.event.cancelBubble = true;
        }
      },
      /**
       * The flag to indicate cancellation state.
       * @type {boolean}
       * @deprecated
       */
      get returnValue() {
        return !pd(this).canceled;
      },
      set returnValue(value) {
        if (!value) {
          setCancelFlag(pd(this));
        }
      },
      /**
       * Initialize this event object. But do nothing under event dispatching.
       * @param {string} type The event type.
       * @param {boolean} [bubbles=false] The flag to be possible to bubble up.
       * @param {boolean} [cancelable=false] The flag to be possible to cancel.
       * @deprecated
       */
      initEvent() {
      }
    };
    Object.defineProperty(Event.prototype, "constructor", {
      value: Event,
      configurable: true,
      writable: true
    });
    if (typeof window !== "undefined" && typeof window.Event !== "undefined") {
      Object.setPrototypeOf(Event.prototype, window.Event.prototype);
      wrappers.set(window.Event.prototype, Event);
    }
    function defineRedirectDescriptor(key) {
      return {
        get() {
          return pd(this).event[key];
        },
        set(value) {
          pd(this).event[key] = value;
        },
        configurable: true,
        enumerable: true
      };
    }
    function defineCallDescriptor(key) {
      return {
        value() {
          const event = pd(this).event;
          return event[key].apply(event, arguments);
        },
        configurable: true,
        enumerable: true
      };
    }
    function defineWrapper(BaseEvent, proto) {
      const keys = Object.keys(proto);
      if (keys.length === 0) {
        return BaseEvent;
      }
      function CustomEvent(eventTarget, event) {
        BaseEvent.call(this, eventTarget, event);
      }
      CustomEvent.prototype = Object.create(BaseEvent.prototype, {
        constructor: { value: CustomEvent, configurable: true, writable: true }
      });
      for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        if (!(key in BaseEvent.prototype)) {
          const descriptor = Object.getOwnPropertyDescriptor(proto, key);
          const isFunc = typeof descriptor.value === "function";
          Object.defineProperty(
            CustomEvent.prototype,
            key,
            isFunc ? defineCallDescriptor(key) : defineRedirectDescriptor(key)
          );
        }
      }
      return CustomEvent;
    }
    function getWrapper(proto) {
      if (proto == null || proto === Object.prototype) {
        return Event;
      }
      let wrapper = wrappers.get(proto);
      if (wrapper == null) {
        wrapper = defineWrapper(getWrapper(Object.getPrototypeOf(proto)), proto);
        wrappers.set(proto, wrapper);
      }
      return wrapper;
    }
    function wrapEvent(eventTarget, event) {
      const Wrapper = getWrapper(Object.getPrototypeOf(event));
      return new Wrapper(eventTarget, event);
    }
    function isStopped(event) {
      return pd(event).immediateStopped;
    }
    function setEventPhase(event, eventPhase) {
      pd(event).eventPhase = eventPhase;
    }
    function setCurrentTarget(event, currentTarget) {
      pd(event).currentTarget = currentTarget;
    }
    function setPassiveListener(event, passiveListener) {
      pd(event).passiveListener = passiveListener;
    }
    var listenersMap = /* @__PURE__ */ new WeakMap();
    var CAPTURE = 1;
    var BUBBLE = 2;
    var ATTRIBUTE = 3;
    function isObject(x) {
      return x !== null && typeof x === "object";
    }
    function getListeners(eventTarget) {
      const listeners = listenersMap.get(eventTarget);
      if (listeners == null) {
        throw new TypeError(
          "'this' is expected an EventTarget object, but got another value."
        );
      }
      return listeners;
    }
    function defineEventAttributeDescriptor(eventName) {
      return {
        get() {
          const listeners = getListeners(this);
          let node = listeners.get(eventName);
          while (node != null) {
            if (node.listenerType === ATTRIBUTE) {
              return node.listener;
            }
            node = node.next;
          }
          return null;
        },
        set(listener) {
          if (typeof listener !== "function" && !isObject(listener)) {
            listener = null;
          }
          const listeners = getListeners(this);
          let prev = null;
          let node = listeners.get(eventName);
          while (node != null) {
            if (node.listenerType === ATTRIBUTE) {
              if (prev !== null) {
                prev.next = node.next;
              } else if (node.next !== null) {
                listeners.set(eventName, node.next);
              } else {
                listeners.delete(eventName);
              }
            } else {
              prev = node;
            }
            node = node.next;
          }
          if (listener !== null) {
            const newNode = {
              listener,
              listenerType: ATTRIBUTE,
              passive: false,
              once: false,
              next: null
            };
            if (prev === null) {
              listeners.set(eventName, newNode);
            } else {
              prev.next = newNode;
            }
          }
        },
        configurable: true,
        enumerable: true
      };
    }
    function defineEventAttribute(eventTargetPrototype, eventName) {
      Object.defineProperty(
        eventTargetPrototype,
        `on${eventName}`,
        defineEventAttributeDescriptor(eventName)
      );
    }
    function defineCustomEventTarget(eventNames) {
      function CustomEventTarget() {
        EventTarget.call(this);
      }
      CustomEventTarget.prototype = Object.create(EventTarget.prototype, {
        constructor: {
          value: CustomEventTarget,
          configurable: true,
          writable: true
        }
      });
      for (let i = 0; i < eventNames.length; ++i) {
        defineEventAttribute(CustomEventTarget.prototype, eventNames[i]);
      }
      return CustomEventTarget;
    }
    function EventTarget() {
      if (this instanceof EventTarget) {
        listenersMap.set(this, /* @__PURE__ */ new Map());
        return;
      }
      if (arguments.length === 1 && Array.isArray(arguments[0])) {
        return defineCustomEventTarget(arguments[0]);
      }
      if (arguments.length > 0) {
        const types = new Array(arguments.length);
        for (let i = 0; i < arguments.length; ++i) {
          types[i] = arguments[i];
        }
        return defineCustomEventTarget(types);
      }
      throw new TypeError("Cannot call a class as a function");
    }
    EventTarget.prototype = {
      /**
       * Add a given listener to this event target.
       * @param {string} eventName The event name to add.
       * @param {Function} listener The listener to add.
       * @param {boolean|{capture?:boolean,passive?:boolean,once?:boolean}} [options] The options for this listener.
       * @returns {void}
       */
      addEventListener(eventName, listener, options) {
        if (listener == null) {
          return;
        }
        if (typeof listener !== "function" && !isObject(listener)) {
          throw new TypeError("'listener' should be a function or an object.");
        }
        const listeners = getListeners(this);
        const optionsIsObj = isObject(options);
        const capture2 = optionsIsObj ? Boolean(options.capture) : Boolean(options);
        const listenerType = capture2 ? CAPTURE : BUBBLE;
        const newNode = {
          listener,
          listenerType,
          passive: optionsIsObj && Boolean(options.passive),
          once: optionsIsObj && Boolean(options.once),
          next: null
        };
        let node = listeners.get(eventName);
        if (node === void 0) {
          listeners.set(eventName, newNode);
          return;
        }
        let prev = null;
        while (node != null) {
          if (node.listener === listener && node.listenerType === listenerType) {
            return;
          }
          prev = node;
          node = node.next;
        }
        prev.next = newNode;
      },
      /**
       * Remove a given listener from this event target.
       * @param {string} eventName The event name to remove.
       * @param {Function} listener The listener to remove.
       * @param {boolean|{capture?:boolean,passive?:boolean,once?:boolean}} [options] The options for this listener.
       * @returns {void}
       */
      removeEventListener(eventName, listener, options) {
        if (listener == null) {
          return;
        }
        const listeners = getListeners(this);
        const capture2 = isObject(options) ? Boolean(options.capture) : Boolean(options);
        const listenerType = capture2 ? CAPTURE : BUBBLE;
        let prev = null;
        let node = listeners.get(eventName);
        while (node != null) {
          if (node.listener === listener && node.listenerType === listenerType) {
            if (prev !== null) {
              prev.next = node.next;
            } else if (node.next !== null) {
              listeners.set(eventName, node.next);
            } else {
              listeners.delete(eventName);
            }
            return;
          }
          prev = node;
          node = node.next;
        }
      },
      /**
       * Dispatch a given event.
       * @param {Event|{type:string}} event The event to dispatch.
       * @returns {boolean} `false` if canceled.
       */
      dispatchEvent(event) {
        if (event == null || typeof event.type !== "string") {
          throw new TypeError('"event.type" should be a string.');
        }
        const listeners = getListeners(this);
        const eventName = event.type;
        let node = listeners.get(eventName);
        if (node == null) {
          return true;
        }
        const wrappedEvent = wrapEvent(this, event);
        let prev = null;
        while (node != null) {
          if (node.once) {
            if (prev !== null) {
              prev.next = node.next;
            } else if (node.next !== null) {
              listeners.set(eventName, node.next);
            } else {
              listeners.delete(eventName);
            }
          } else {
            prev = node;
          }
          setPassiveListener(
            wrappedEvent,
            node.passive ? node.listener : null
          );
          if (typeof node.listener === "function") {
            try {
              node.listener.call(this, wrappedEvent);
            } catch (err2) {
              if (typeof console !== "undefined" && typeof console.error === "function") {
                console.error(err2);
              }
            }
          } else if (node.listenerType !== ATTRIBUTE && typeof node.listener.handleEvent === "function") {
            node.listener.handleEvent(wrappedEvent);
          }
          if (isStopped(wrappedEvent)) {
            break;
          }
          node = node.next;
        }
        setPassiveListener(wrappedEvent, null);
        setEventPhase(wrappedEvent, 0);
        setCurrentTarget(wrappedEvent, null);
        return !wrappedEvent.defaultPrevented;
      }
    };
    Object.defineProperty(EventTarget.prototype, "constructor", {
      value: EventTarget,
      configurable: true,
      writable: true
    });
    if (typeof window !== "undefined" && typeof window.EventTarget !== "undefined") {
      Object.setPrototypeOf(EventTarget.prototype, window.EventTarget.prototype);
    }
    exports.defineEventAttribute = defineEventAttribute;
    exports.EventTarget = EventTarget;
    exports.default = EventTarget;
    module.exports = EventTarget;
    module.exports.EventTarget = module.exports["default"] = EventTarget;
    module.exports.defineEventAttribute = defineEventAttribute;
  }
});

// ../../node_modules/.pnpm/abort-controller@3.0.0/node_modules/abort-controller/dist/abort-controller.js
var require_abort_controller = __commonJS({
  "../../node_modules/.pnpm/abort-controller@3.0.0/node_modules/abort-controller/dist/abort-controller.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var eventTargetShim = require_event_target_shim();
    var AbortSignal = class extends eventTargetShim.EventTarget {
      /**
       * AbortSignal cannot be constructed directly.
       */
      constructor() {
        super();
        throw new TypeError("AbortSignal cannot be constructed directly");
      }
      /**
       * Returns `true` if this `AbortSignal`'s `AbortController` has signaled to abort, and `false` otherwise.
       */
      get aborted() {
        const aborted = abortedFlags.get(this);
        if (typeof aborted !== "boolean") {
          throw new TypeError(`Expected 'this' to be an 'AbortSignal' object, but got ${this === null ? "null" : typeof this}`);
        }
        return aborted;
      }
    };
    eventTargetShim.defineEventAttribute(AbortSignal.prototype, "abort");
    function createAbortSignal() {
      const signal = Object.create(AbortSignal.prototype);
      eventTargetShim.EventTarget.call(signal);
      abortedFlags.set(signal, false);
      return signal;
    }
    function abortSignal(signal) {
      if (abortedFlags.get(signal) !== false) {
        return;
      }
      abortedFlags.set(signal, true);
      signal.dispatchEvent({ type: "abort" });
    }
    var abortedFlags = /* @__PURE__ */ new WeakMap();
    Object.defineProperties(AbortSignal.prototype, {
      aborted: { enumerable: true }
    });
    if (typeof Symbol === "function" && typeof Symbol.toStringTag === "symbol") {
      Object.defineProperty(AbortSignal.prototype, Symbol.toStringTag, {
        configurable: true,
        value: "AbortSignal"
      });
    }
    var AbortController = class {
      /**
       * Initialize this controller.
       */
      constructor() {
        signals.set(this, createAbortSignal());
      }
      /**
       * Returns the `AbortSignal` object associated with this object.
       */
      get signal() {
        return getSignal(this);
      }
      /**
       * Abort and signal to any observers that the associated activity is to be aborted.
       */
      abort() {
        abortSignal(getSignal(this));
      }
    };
    var signals = /* @__PURE__ */ new WeakMap();
    function getSignal(controller) {
      const signal = signals.get(controller);
      if (signal == null) {
        throw new TypeError(`Expected 'this' to be an 'AbortController' object, but got ${controller === null ? "null" : typeof controller}`);
      }
      return signal;
    }
    Object.defineProperties(AbortController.prototype, {
      signal: { enumerable: true },
      abort: { enumerable: true }
    });
    if (typeof Symbol === "function" && typeof Symbol.toStringTag === "symbol") {
      Object.defineProperty(AbortController.prototype, Symbol.toStringTag, {
        configurable: true,
        value: "AbortController"
      });
    }
    exports.AbortController = AbortController;
    exports.AbortSignal = AbortSignal;
    exports.default = AbortController;
    module.exports = AbortController;
    module.exports.AbortController = module.exports["default"] = AbortController;
    module.exports.AbortSignal = AbortSignal;
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/ours/util.js
var require_util = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/ours/util.js"(exports, module) {
    "use strict";
    var bufferModule = __require("buffer");
    var { format, inspect } = require_inspect();
    var {
      codes: { ERR_INVALID_ARG_TYPE }
    } = require_errors();
    var { kResistStopPropagation, AggregateError, SymbolDispose } = require_primordials();
    var AbortSignal = globalThis.AbortSignal || require_abort_controller().AbortSignal;
    var AbortController = globalThis.AbortController || require_abort_controller().AbortController;
    var AsyncFunction = Object.getPrototypeOf(async function() {
    }).constructor;
    var Blob = globalThis.Blob || bufferModule.Blob;
    var isBlob = typeof Blob !== "undefined" ? function isBlob2(b) {
      return b instanceof Blob;
    } : function isBlob2(b) {
      return false;
    };
    var validateAbortSignal = (signal, name) => {
      if (signal !== void 0 && (signal === null || typeof signal !== "object" || !("aborted" in signal))) {
        throw new ERR_INVALID_ARG_TYPE(name, "AbortSignal", signal);
      }
    };
    var validateFunction = (value, name) => {
      if (typeof value !== "function") {
        throw new ERR_INVALID_ARG_TYPE(name, "Function", value);
      }
    };
    module.exports = {
      AggregateError,
      kEmptyObject: Object.freeze({}),
      once(callback) {
        let called = false;
        return function(...args) {
          if (called) {
            return;
          }
          called = true;
          callback.apply(this, args);
        };
      },
      createDeferredPromise: function() {
        let resolve3;
        let reject;
        const promise = new Promise((res, rej) => {
          resolve3 = res;
          reject = rej;
        });
        return {
          promise,
          resolve: resolve3,
          reject
        };
      },
      promisify(fn) {
        return new Promise((resolve3, reject) => {
          fn((err2, ...args) => {
            if (err2) {
              return reject(err2);
            }
            return resolve3(...args);
          });
        });
      },
      debuglog() {
        return function() {
        };
      },
      format,
      inspect,
      types: {
        isAsyncFunction(fn) {
          return fn instanceof AsyncFunction;
        },
        isArrayBufferView(arr) {
          return ArrayBuffer.isView(arr);
        }
      },
      isBlob,
      deprecate(fn, message) {
        return fn;
      },
      addAbortListener: __require("events").addAbortListener || function addAbortListener(signal, listener) {
        if (signal === void 0) {
          throw new ERR_INVALID_ARG_TYPE("signal", "AbortSignal", signal);
        }
        validateAbortSignal(signal, "signal");
        validateFunction(listener, "listener");
        let removeEventListener;
        if (signal.aborted) {
          queueMicrotask(() => listener());
        } else {
          signal.addEventListener("abort", listener, {
            __proto__: null,
            once: true,
            [kResistStopPropagation]: true
          });
          removeEventListener = () => {
            signal.removeEventListener("abort", listener);
          };
        }
        return {
          __proto__: null,
          [SymbolDispose]() {
            var _removeEventListener;
            (_removeEventListener = removeEventListener) === null || _removeEventListener === void 0 ? void 0 : _removeEventListener();
          }
        };
      },
      AbortSignalAny: AbortSignal.any || function AbortSignalAny(signals) {
        if (signals.length === 1) {
          return signals[0];
        }
        const ac = new AbortController();
        const abort = () => ac.abort();
        signals.forEach((signal) => {
          validateAbortSignal(signal, "signals");
          signal.addEventListener("abort", abort, {
            once: true
          });
        });
        ac.signal.addEventListener(
          "abort",
          () => {
            signals.forEach((signal) => signal.removeEventListener("abort", abort));
          },
          {
            once: true
          }
        );
        return ac.signal;
      }
    };
    module.exports.promisify.custom = /* @__PURE__ */ Symbol.for("nodejs.util.promisify.custom");
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/validators.js
var require_validators = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/validators.js"(exports, module) {
    "use strict";
    var {
      ArrayIsArray,
      ArrayPrototypeIncludes,
      ArrayPrototypeJoin,
      ArrayPrototypeMap,
      NumberIsInteger,
      NumberIsNaN,
      NumberMAX_SAFE_INTEGER,
      NumberMIN_SAFE_INTEGER,
      NumberParseInt,
      ObjectPrototypeHasOwnProperty,
      RegExpPrototypeExec,
      String: String2,
      StringPrototypeToUpperCase,
      StringPrototypeTrim
    } = require_primordials();
    var {
      hideStackFrames,
      codes: { ERR_SOCKET_BAD_PORT, ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE, ERR_OUT_OF_RANGE, ERR_UNKNOWN_SIGNAL }
    } = require_errors();
    var { normalizeEncoding } = require_util();
    var { isAsyncFunction, isArrayBufferView } = require_util().types;
    var signals = {};
    function isInt32(value) {
      return value === (value | 0);
    }
    function isUint32(value) {
      return value === value >>> 0;
    }
    var octalReg = /^[0-7]+$/;
    var modeDesc = "must be a 32-bit unsigned integer or an octal string";
    function parseFileMode(value, name, def) {
      if (typeof value === "undefined") {
        value = def;
      }
      if (typeof value === "string") {
        if (RegExpPrototypeExec(octalReg, value) === null) {
          throw new ERR_INVALID_ARG_VALUE(name, value, modeDesc);
        }
        value = NumberParseInt(value, 8);
      }
      validateUint32(value, name);
      return value;
    }
    var validateInteger = hideStackFrames((value, name, min = NumberMIN_SAFE_INTEGER, max = NumberMAX_SAFE_INTEGER) => {
      if (typeof value !== "number") throw new ERR_INVALID_ARG_TYPE(name, "number", value);
      if (!NumberIsInteger(value)) throw new ERR_OUT_OF_RANGE(name, "an integer", value);
      if (value < min || value > max) throw new ERR_OUT_OF_RANGE(name, `>= ${min} && <= ${max}`, value);
    });
    var validateInt32 = hideStackFrames((value, name, min = -2147483648, max = 2147483647) => {
      if (typeof value !== "number") {
        throw new ERR_INVALID_ARG_TYPE(name, "number", value);
      }
      if (!NumberIsInteger(value)) {
        throw new ERR_OUT_OF_RANGE(name, "an integer", value);
      }
      if (value < min || value > max) {
        throw new ERR_OUT_OF_RANGE(name, `>= ${min} && <= ${max}`, value);
      }
    });
    var validateUint32 = hideStackFrames((value, name, positive = false) => {
      if (typeof value !== "number") {
        throw new ERR_INVALID_ARG_TYPE(name, "number", value);
      }
      if (!NumberIsInteger(value)) {
        throw new ERR_OUT_OF_RANGE(name, "an integer", value);
      }
      const min = positive ? 1 : 0;
      const max = 4294967295;
      if (value < min || value > max) {
        throw new ERR_OUT_OF_RANGE(name, `>= ${min} && <= ${max}`, value);
      }
    });
    function validateString(value, name) {
      if (typeof value !== "string") throw new ERR_INVALID_ARG_TYPE(name, "string", value);
    }
    function validateNumber(value, name, min = void 0, max) {
      if (typeof value !== "number") throw new ERR_INVALID_ARG_TYPE(name, "number", value);
      if (min != null && value < min || max != null && value > max || (min != null || max != null) && NumberIsNaN(value)) {
        throw new ERR_OUT_OF_RANGE(
          name,
          `${min != null ? `>= ${min}` : ""}${min != null && max != null ? " && " : ""}${max != null ? `<= ${max}` : ""}`,
          value
        );
      }
    }
    var validateOneOf = hideStackFrames((value, name, oneOf) => {
      if (!ArrayPrototypeIncludes(oneOf, value)) {
        const allowed = ArrayPrototypeJoin(
          ArrayPrototypeMap(oneOf, (v) => typeof v === "string" ? `'${v}'` : String2(v)),
          ", "
        );
        const reason = "must be one of: " + allowed;
        throw new ERR_INVALID_ARG_VALUE(name, value, reason);
      }
    });
    function validateBoolean(value, name) {
      if (typeof value !== "boolean") throw new ERR_INVALID_ARG_TYPE(name, "boolean", value);
    }
    function getOwnPropertyValueOrDefault(options, key, defaultValue) {
      return options == null || !ObjectPrototypeHasOwnProperty(options, key) ? defaultValue : options[key];
    }
    var validateObject = hideStackFrames((value, name, options = null) => {
      const allowArray = getOwnPropertyValueOrDefault(options, "allowArray", false);
      const allowFunction = getOwnPropertyValueOrDefault(options, "allowFunction", false);
      const nullable = getOwnPropertyValueOrDefault(options, "nullable", false);
      if (!nullable && value === null || !allowArray && ArrayIsArray(value) || typeof value !== "object" && (!allowFunction || typeof value !== "function")) {
        throw new ERR_INVALID_ARG_TYPE(name, "Object", value);
      }
    });
    var validateDictionary = hideStackFrames((value, name) => {
      if (value != null && typeof value !== "object" && typeof value !== "function") {
        throw new ERR_INVALID_ARG_TYPE(name, "a dictionary", value);
      }
    });
    var validateArray = hideStackFrames((value, name, minLength = 0) => {
      if (!ArrayIsArray(value)) {
        throw new ERR_INVALID_ARG_TYPE(name, "Array", value);
      }
      if (value.length < minLength) {
        const reason = `must be longer than ${minLength}`;
        throw new ERR_INVALID_ARG_VALUE(name, value, reason);
      }
    });
    function validateStringArray(value, name) {
      validateArray(value, name);
      for (let i = 0; i < value.length; i++) {
        validateString(value[i], `${name}[${i}]`);
      }
    }
    function validateBooleanArray(value, name) {
      validateArray(value, name);
      for (let i = 0; i < value.length; i++) {
        validateBoolean(value[i], `${name}[${i}]`);
      }
    }
    function validateAbortSignalArray(value, name) {
      validateArray(value, name);
      for (let i = 0; i < value.length; i++) {
        const signal = value[i];
        const indexedName = `${name}[${i}]`;
        if (signal == null) {
          throw new ERR_INVALID_ARG_TYPE(indexedName, "AbortSignal", signal);
        }
        validateAbortSignal(signal, indexedName);
      }
    }
    function validateSignalName(signal, name = "signal") {
      validateString(signal, name);
      if (signals[signal] === void 0) {
        if (signals[StringPrototypeToUpperCase(signal)] !== void 0) {
          throw new ERR_UNKNOWN_SIGNAL(signal + " (signals must use all capital letters)");
        }
        throw new ERR_UNKNOWN_SIGNAL(signal);
      }
    }
    var validateBuffer = hideStackFrames((buffer, name = "buffer") => {
      if (!isArrayBufferView(buffer)) {
        throw new ERR_INVALID_ARG_TYPE(name, ["Buffer", "TypedArray", "DataView"], buffer);
      }
    });
    function validateEncoding(data, encoding) {
      const normalizedEncoding = normalizeEncoding(encoding);
      const length = data.length;
      if (normalizedEncoding === "hex" && length % 2 !== 0) {
        throw new ERR_INVALID_ARG_VALUE("encoding", encoding, `is invalid for data of length ${length}`);
      }
    }
    function validatePort(port, name = "Port", allowZero = true) {
      if (typeof port !== "number" && typeof port !== "string" || typeof port === "string" && StringPrototypeTrim(port).length === 0 || +port !== +port >>> 0 || port > 65535 || port === 0 && !allowZero) {
        throw new ERR_SOCKET_BAD_PORT(name, port, allowZero);
      }
      return port | 0;
    }
    var validateAbortSignal = hideStackFrames((signal, name) => {
      if (signal !== void 0 && (signal === null || typeof signal !== "object" || !("aborted" in signal))) {
        throw new ERR_INVALID_ARG_TYPE(name, "AbortSignal", signal);
      }
    });
    var validateFunction = hideStackFrames((value, name) => {
      if (typeof value !== "function") throw new ERR_INVALID_ARG_TYPE(name, "Function", value);
    });
    var validatePlainFunction = hideStackFrames((value, name) => {
      if (typeof value !== "function" || isAsyncFunction(value)) throw new ERR_INVALID_ARG_TYPE(name, "Function", value);
    });
    var validateUndefined = hideStackFrames((value, name) => {
      if (value !== void 0) throw new ERR_INVALID_ARG_TYPE(name, "undefined", value);
    });
    function validateUnion(value, name, union) {
      if (!ArrayPrototypeIncludes(union, value)) {
        throw new ERR_INVALID_ARG_TYPE(name, `('${ArrayPrototypeJoin(union, "|")}')`, value);
      }
    }
    var linkValueRegExp = /^(?:<[^>]*>)(?:\s*;\s*[^;"\s]+(?:=(")?[^;"\s]*\1)?)*$/;
    function validateLinkHeaderFormat(value, name) {
      if (typeof value === "undefined" || !RegExpPrototypeExec(linkValueRegExp, value)) {
        throw new ERR_INVALID_ARG_VALUE(
          name,
          value,
          'must be an array or string of format "</styles.css>; rel=preload; as=style"'
        );
      }
    }
    function validateLinkHeaderValue(hints) {
      if (typeof hints === "string") {
        validateLinkHeaderFormat(hints, "hints");
        return hints;
      } else if (ArrayIsArray(hints)) {
        const hintsLength = hints.length;
        let result = "";
        if (hintsLength === 0) {
          return result;
        }
        for (let i = 0; i < hintsLength; i++) {
          const link = hints[i];
          validateLinkHeaderFormat(link, "hints");
          result += link;
          if (i !== hintsLength - 1) {
            result += ", ";
          }
        }
        return result;
      }
      throw new ERR_INVALID_ARG_VALUE(
        "hints",
        hints,
        'must be an array or string of format "</styles.css>; rel=preload; as=style"'
      );
    }
    module.exports = {
      isInt32,
      isUint32,
      parseFileMode,
      validateArray,
      validateStringArray,
      validateBooleanArray,
      validateAbortSignalArray,
      validateBoolean,
      validateBuffer,
      validateDictionary,
      validateEncoding,
      validateFunction,
      validateInt32,
      validateInteger,
      validateNumber,
      validateObject,
      validateOneOf,
      validatePlainFunction,
      validatePort,
      validateSignalName,
      validateString,
      validateUint32,
      validateUndefined,
      validateUnion,
      validateAbortSignal,
      validateLinkHeaderValue
    };
  }
});

// ../../node_modules/.pnpm/process@0.11.10/node_modules/process/index.js
var require_process = __commonJS({
  "../../node_modules/.pnpm/process@0.11.10/node_modules/process/index.js"(exports, module) {
    module.exports = global.process;
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/utils.js
var require_utils = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/utils.js"(exports, module) {
    "use strict";
    var { SymbolAsyncIterator, SymbolIterator, SymbolFor } = require_primordials();
    var kIsDestroyed = SymbolFor("nodejs.stream.destroyed");
    var kIsErrored = SymbolFor("nodejs.stream.errored");
    var kIsReadable = SymbolFor("nodejs.stream.readable");
    var kIsWritable = SymbolFor("nodejs.stream.writable");
    var kIsDisturbed = SymbolFor("nodejs.stream.disturbed");
    var kIsClosedPromise = SymbolFor("nodejs.webstream.isClosedPromise");
    var kControllerErrorFunction = SymbolFor("nodejs.webstream.controllerErrorFunction");
    function isReadableNodeStream(obj, strict111 = false) {
      var _obj$_readableState;
      return !!(obj && typeof obj.pipe === "function" && typeof obj.on === "function" && (!strict111 || typeof obj.pause === "function" && typeof obj.resume === "function") && (!obj._writableState || ((_obj$_readableState = obj._readableState) === null || _obj$_readableState === void 0 ? void 0 : _obj$_readableState.readable) !== false) && // Duplex
      (!obj._writableState || obj._readableState));
    }
    function isWritableNodeStream(obj) {
      var _obj$_writableState;
      return !!(obj && typeof obj.write === "function" && typeof obj.on === "function" && (!obj._readableState || ((_obj$_writableState = obj._writableState) === null || _obj$_writableState === void 0 ? void 0 : _obj$_writableState.writable) !== false));
    }
    function isDuplexNodeStream(obj) {
      return !!(obj && typeof obj.pipe === "function" && obj._readableState && typeof obj.on === "function" && typeof obj.write === "function");
    }
    function isNodeStream(obj) {
      return obj && (obj._readableState || obj._writableState || typeof obj.write === "function" && typeof obj.on === "function" || typeof obj.pipe === "function" && typeof obj.on === "function");
    }
    function isReadableStream(obj) {
      return !!(obj && !isNodeStream(obj) && typeof obj.pipeThrough === "function" && typeof obj.getReader === "function" && typeof obj.cancel === "function");
    }
    function isWritableStream(obj) {
      return !!(obj && !isNodeStream(obj) && typeof obj.getWriter === "function" && typeof obj.abort === "function");
    }
    function isTransformStream(obj) {
      return !!(obj && !isNodeStream(obj) && typeof obj.readable === "object" && typeof obj.writable === "object");
    }
    function isWebStream(obj) {
      return isReadableStream(obj) || isWritableStream(obj) || isTransformStream(obj);
    }
    function isIterable(obj, isAsync) {
      if (obj == null) return false;
      if (isAsync === true) return typeof obj[SymbolAsyncIterator] === "function";
      if (isAsync === false) return typeof obj[SymbolIterator] === "function";
      return typeof obj[SymbolAsyncIterator] === "function" || typeof obj[SymbolIterator] === "function";
    }
    function isDestroyed(stream) {
      if (!isNodeStream(stream)) return null;
      const wState = stream._writableState;
      const rState = stream._readableState;
      const state = wState || rState;
      return !!(stream.destroyed || stream[kIsDestroyed] || state !== null && state !== void 0 && state.destroyed);
    }
    function isWritableEnded(stream) {
      if (!isWritableNodeStream(stream)) return null;
      if (stream.writableEnded === true) return true;
      const wState = stream._writableState;
      if (wState !== null && wState !== void 0 && wState.errored) return false;
      if (typeof (wState === null || wState === void 0 ? void 0 : wState.ended) !== "boolean") return null;
      return wState.ended;
    }
    function isWritableFinished(stream, strict111) {
      if (!isWritableNodeStream(stream)) return null;
      if (stream.writableFinished === true) return true;
      const wState = stream._writableState;
      if (wState !== null && wState !== void 0 && wState.errored) return false;
      if (typeof (wState === null || wState === void 0 ? void 0 : wState.finished) !== "boolean") return null;
      return !!(wState.finished || strict111 === false && wState.ended === true && wState.length === 0);
    }
    function isReadableEnded(stream) {
      if (!isReadableNodeStream(stream)) return null;
      if (stream.readableEnded === true) return true;
      const rState = stream._readableState;
      if (!rState || rState.errored) return false;
      if (typeof (rState === null || rState === void 0 ? void 0 : rState.ended) !== "boolean") return null;
      return rState.ended;
    }
    function isReadableFinished(stream, strict111) {
      if (!isReadableNodeStream(stream)) return null;
      const rState = stream._readableState;
      if (rState !== null && rState !== void 0 && rState.errored) return false;
      if (typeof (rState === null || rState === void 0 ? void 0 : rState.endEmitted) !== "boolean") return null;
      return !!(rState.endEmitted || strict111 === false && rState.ended === true && rState.length === 0);
    }
    function isReadable(stream) {
      if (stream && stream[kIsReadable] != null) return stream[kIsReadable];
      if (typeof (stream === null || stream === void 0 ? void 0 : stream.readable) !== "boolean") return null;
      if (isDestroyed(stream)) return false;
      return isReadableNodeStream(stream) && stream.readable && !isReadableFinished(stream);
    }
    function isWritable(stream) {
      if (stream && stream[kIsWritable] != null) return stream[kIsWritable];
      if (typeof (stream === null || stream === void 0 ? void 0 : stream.writable) !== "boolean") return null;
      if (isDestroyed(stream)) return false;
      return isWritableNodeStream(stream) && stream.writable && !isWritableEnded(stream);
    }
    function isFinished(stream, opts) {
      if (!isNodeStream(stream)) {
        return null;
      }
      if (isDestroyed(stream)) {
        return true;
      }
      if ((opts === null || opts === void 0 ? void 0 : opts.readable) !== false && isReadable(stream)) {
        return false;
      }
      if ((opts === null || opts === void 0 ? void 0 : opts.writable) !== false && isWritable(stream)) {
        return false;
      }
      return true;
    }
    function isWritableErrored(stream) {
      var _stream$_writableStat, _stream$_writableStat2;
      if (!isNodeStream(stream)) {
        return null;
      }
      if (stream.writableErrored) {
        return stream.writableErrored;
      }
      return (_stream$_writableStat = (_stream$_writableStat2 = stream._writableState) === null || _stream$_writableStat2 === void 0 ? void 0 : _stream$_writableStat2.errored) !== null && _stream$_writableStat !== void 0 ? _stream$_writableStat : null;
    }
    function isReadableErrored(stream) {
      var _stream$_readableStat, _stream$_readableStat2;
      if (!isNodeStream(stream)) {
        return null;
      }
      if (stream.readableErrored) {
        return stream.readableErrored;
      }
      return (_stream$_readableStat = (_stream$_readableStat2 = stream._readableState) === null || _stream$_readableStat2 === void 0 ? void 0 : _stream$_readableStat2.errored) !== null && _stream$_readableStat !== void 0 ? _stream$_readableStat : null;
    }
    function isClosed(stream) {
      if (!isNodeStream(stream)) {
        return null;
      }
      if (typeof stream.closed === "boolean") {
        return stream.closed;
      }
      const wState = stream._writableState;
      const rState = stream._readableState;
      if (typeof (wState === null || wState === void 0 ? void 0 : wState.closed) === "boolean" || typeof (rState === null || rState === void 0 ? void 0 : rState.closed) === "boolean") {
        return (wState === null || wState === void 0 ? void 0 : wState.closed) || (rState === null || rState === void 0 ? void 0 : rState.closed);
      }
      if (typeof stream._closed === "boolean" && isOutgoingMessage(stream)) {
        return stream._closed;
      }
      return null;
    }
    function isOutgoingMessage(stream) {
      return typeof stream._closed === "boolean" && typeof stream._defaultKeepAlive === "boolean" && typeof stream._removedConnection === "boolean" && typeof stream._removedContLen === "boolean";
    }
    function isServerResponse(stream) {
      return typeof stream._sent100 === "boolean" && isOutgoingMessage(stream);
    }
    function isServerRequest(stream) {
      var _stream$req;
      return typeof stream._consuming === "boolean" && typeof stream._dumped === "boolean" && ((_stream$req = stream.req) === null || _stream$req === void 0 ? void 0 : _stream$req.upgradeOrConnect) === void 0;
    }
    function willEmitClose(stream) {
      if (!isNodeStream(stream)) return null;
      const wState = stream._writableState;
      const rState = stream._readableState;
      const state = wState || rState;
      return !state && isServerResponse(stream) || !!(state && state.autoDestroy && state.emitClose && state.closed === false);
    }
    function isDisturbed(stream) {
      var _stream$kIsDisturbed;
      return !!(stream && ((_stream$kIsDisturbed = stream[kIsDisturbed]) !== null && _stream$kIsDisturbed !== void 0 ? _stream$kIsDisturbed : stream.readableDidRead || stream.readableAborted));
    }
    function isErrored(stream) {
      var _ref, _ref2, _ref3, _ref4, _ref5, _stream$kIsErrored, _stream$_readableStat3, _stream$_writableStat3, _stream$_readableStat4, _stream$_writableStat4;
      return !!(stream && ((_ref = (_ref2 = (_ref3 = (_ref4 = (_ref5 = (_stream$kIsErrored = stream[kIsErrored]) !== null && _stream$kIsErrored !== void 0 ? _stream$kIsErrored : stream.readableErrored) !== null && _ref5 !== void 0 ? _ref5 : stream.writableErrored) !== null && _ref4 !== void 0 ? _ref4 : (_stream$_readableStat3 = stream._readableState) === null || _stream$_readableStat3 === void 0 ? void 0 : _stream$_readableStat3.errorEmitted) !== null && _ref3 !== void 0 ? _ref3 : (_stream$_writableStat3 = stream._writableState) === null || _stream$_writableStat3 === void 0 ? void 0 : _stream$_writableStat3.errorEmitted) !== null && _ref2 !== void 0 ? _ref2 : (_stream$_readableStat4 = stream._readableState) === null || _stream$_readableStat4 === void 0 ? void 0 : _stream$_readableStat4.errored) !== null && _ref !== void 0 ? _ref : (_stream$_writableStat4 = stream._writableState) === null || _stream$_writableStat4 === void 0 ? void 0 : _stream$_writableStat4.errored));
    }
    module.exports = {
      isDestroyed,
      kIsDestroyed,
      isDisturbed,
      kIsDisturbed,
      isErrored,
      kIsErrored,
      isReadable,
      kIsReadable,
      kIsClosedPromise,
      kControllerErrorFunction,
      kIsWritable,
      isClosed,
      isDuplexNodeStream,
      isFinished,
      isIterable,
      isReadableNodeStream,
      isReadableStream,
      isReadableEnded,
      isReadableFinished,
      isReadableErrored,
      isNodeStream,
      isWebStream,
      isWritable,
      isWritableNodeStream,
      isWritableStream,
      isWritableEnded,
      isWritableFinished,
      isWritableErrored,
      isServerRequest,
      isServerResponse,
      willEmitClose,
      isTransformStream
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/end-of-stream.js
var require_end_of_stream = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/end-of-stream.js"(exports, module) {
    "use strict";
    var process2 = require_process();
    var { AbortError, codes } = require_errors();
    var { ERR_INVALID_ARG_TYPE, ERR_STREAM_PREMATURE_CLOSE } = codes;
    var { kEmptyObject, once } = require_util();
    var { validateAbortSignal, validateFunction, validateObject, validateBoolean } = require_validators();
    var { Promise: Promise2, PromisePrototypeThen, SymbolDispose } = require_primordials();
    var {
      isClosed,
      isReadable,
      isReadableNodeStream,
      isReadableStream,
      isReadableFinished,
      isReadableErrored,
      isWritable,
      isWritableNodeStream,
      isWritableStream,
      isWritableFinished,
      isWritableErrored,
      isNodeStream,
      willEmitClose: _willEmitClose,
      kIsClosedPromise
    } = require_utils();
    var addAbortListener;
    function isRequest(stream) {
      return stream.setHeader && typeof stream.abort === "function";
    }
    var nop = () => {
    };
    function eos(stream, options, callback) {
      var _options$readable, _options$writable;
      if (arguments.length === 2) {
        callback = options;
        options = kEmptyObject;
      } else if (options == null) {
        options = kEmptyObject;
      } else {
        validateObject(options, "options");
      }
      validateFunction(callback, "callback");
      validateAbortSignal(options.signal, "options.signal");
      callback = once(callback);
      if (isReadableStream(stream) || isWritableStream(stream)) {
        return eosWeb(stream, options, callback);
      }
      if (!isNodeStream(stream)) {
        throw new ERR_INVALID_ARG_TYPE("stream", ["ReadableStream", "WritableStream", "Stream"], stream);
      }
      const readable = (_options$readable = options.readable) !== null && _options$readable !== void 0 ? _options$readable : isReadableNodeStream(stream);
      const writable = (_options$writable = options.writable) !== null && _options$writable !== void 0 ? _options$writable : isWritableNodeStream(stream);
      const wState = stream._writableState;
      const rState = stream._readableState;
      const onlegacyfinish = () => {
        if (!stream.writable) {
          onfinish();
        }
      };
      let willEmitClose = _willEmitClose(stream) && isReadableNodeStream(stream) === readable && isWritableNodeStream(stream) === writable;
      let writableFinished = isWritableFinished(stream, false);
      const onfinish = () => {
        writableFinished = true;
        if (stream.destroyed) {
          willEmitClose = false;
        }
        if (willEmitClose && (!stream.readable || readable)) {
          return;
        }
        if (!readable || readableFinished) {
          callback.call(stream);
        }
      };
      let readableFinished = isReadableFinished(stream, false);
      const onend = () => {
        readableFinished = true;
        if (stream.destroyed) {
          willEmitClose = false;
        }
        if (willEmitClose && (!stream.writable || writable)) {
          return;
        }
        if (!writable || writableFinished) {
          callback.call(stream);
        }
      };
      const onerror = (err2) => {
        callback.call(stream, err2);
      };
      let closed = isClosed(stream);
      const onclose = () => {
        closed = true;
        const errored = isWritableErrored(stream) || isReadableErrored(stream);
        if (errored && typeof errored !== "boolean") {
          return callback.call(stream, errored);
        }
        if (readable && !readableFinished && isReadableNodeStream(stream, true)) {
          if (!isReadableFinished(stream, false)) return callback.call(stream, new ERR_STREAM_PREMATURE_CLOSE());
        }
        if (writable && !writableFinished) {
          if (!isWritableFinished(stream, false)) return callback.call(stream, new ERR_STREAM_PREMATURE_CLOSE());
        }
        callback.call(stream);
      };
      const onclosed = () => {
        closed = true;
        const errored = isWritableErrored(stream) || isReadableErrored(stream);
        if (errored && typeof errored !== "boolean") {
          return callback.call(stream, errored);
        }
        callback.call(stream);
      };
      const onrequest = () => {
        stream.req.on("finish", onfinish);
      };
      if (isRequest(stream)) {
        stream.on("complete", onfinish);
        if (!willEmitClose) {
          stream.on("abort", onclose);
        }
        if (stream.req) {
          onrequest();
        } else {
          stream.on("request", onrequest);
        }
      } else if (writable && !wState) {
        stream.on("end", onlegacyfinish);
        stream.on("close", onlegacyfinish);
      }
      if (!willEmitClose && typeof stream.aborted === "boolean") {
        stream.on("aborted", onclose);
      }
      stream.on("end", onend);
      stream.on("finish", onfinish);
      if (options.error !== false) {
        stream.on("error", onerror);
      }
      stream.on("close", onclose);
      if (closed) {
        process2.nextTick(onclose);
      } else if (wState !== null && wState !== void 0 && wState.errorEmitted || rState !== null && rState !== void 0 && rState.errorEmitted) {
        if (!willEmitClose) {
          process2.nextTick(onclosed);
        }
      } else if (!readable && (!willEmitClose || isReadable(stream)) && (writableFinished || isWritable(stream) === false)) {
        process2.nextTick(onclosed);
      } else if (!writable && (!willEmitClose || isWritable(stream)) && (readableFinished || isReadable(stream) === false)) {
        process2.nextTick(onclosed);
      } else if (rState && stream.req && stream.aborted) {
        process2.nextTick(onclosed);
      }
      const cleanup = () => {
        callback = nop;
        stream.removeListener("aborted", onclose);
        stream.removeListener("complete", onfinish);
        stream.removeListener("abort", onclose);
        stream.removeListener("request", onrequest);
        if (stream.req) stream.req.removeListener("finish", onfinish);
        stream.removeListener("end", onlegacyfinish);
        stream.removeListener("close", onlegacyfinish);
        stream.removeListener("finish", onfinish);
        stream.removeListener("end", onend);
        stream.removeListener("error", onerror);
        stream.removeListener("close", onclose);
      };
      if (options.signal && !closed) {
        const abort = () => {
          const endCallback = callback;
          cleanup();
          endCallback.call(
            stream,
            new AbortError(void 0, {
              cause: options.signal.reason
            })
          );
        };
        if (options.signal.aborted) {
          process2.nextTick(abort);
        } else {
          addAbortListener = addAbortListener || require_util().addAbortListener;
          const disposable = addAbortListener(options.signal, abort);
          const originalCallback = callback;
          callback = once((...args) => {
            disposable[SymbolDispose]();
            originalCallback.apply(stream, args);
          });
        }
      }
      return cleanup;
    }
    function eosWeb(stream, options, callback) {
      let isAborted = false;
      let abort = nop;
      if (options.signal) {
        abort = () => {
          isAborted = true;
          callback.call(
            stream,
            new AbortError(void 0, {
              cause: options.signal.reason
            })
          );
        };
        if (options.signal.aborted) {
          process2.nextTick(abort);
        } else {
          addAbortListener = addAbortListener || require_util().addAbortListener;
          const disposable = addAbortListener(options.signal, abort);
          const originalCallback = callback;
          callback = once((...args) => {
            disposable[SymbolDispose]();
            originalCallback.apply(stream, args);
          });
        }
      }
      const resolverFn = (...args) => {
        if (!isAborted) {
          process2.nextTick(() => callback.apply(stream, args));
        }
      };
      PromisePrototypeThen(stream[kIsClosedPromise].promise, resolverFn, resolverFn);
      return nop;
    }
    function finished(stream, opts) {
      var _opts;
      let autoCleanup = false;
      if (opts === null) {
        opts = kEmptyObject;
      }
      if ((_opts = opts) !== null && _opts !== void 0 && _opts.cleanup) {
        validateBoolean(opts.cleanup, "cleanup");
        autoCleanup = opts.cleanup;
      }
      return new Promise2((resolve3, reject) => {
        const cleanup = eos(stream, opts, (err2) => {
          if (autoCleanup) {
            cleanup();
          }
          if (err2) {
            reject(err2);
          } else {
            resolve3();
          }
        });
      });
    }
    module.exports = eos;
    module.exports.finished = finished;
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/destroy.js
var require_destroy = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/destroy.js"(exports, module) {
    "use strict";
    var process2 = require_process();
    var {
      aggregateTwoErrors,
      codes: { ERR_MULTIPLE_CALLBACK },
      AbortError
    } = require_errors();
    var { Symbol: Symbol2 } = require_primordials();
    var { kIsDestroyed, isDestroyed, isFinished, isServerRequest } = require_utils();
    var kDestroy = Symbol2("kDestroy");
    var kConstruct = Symbol2("kConstruct");
    function checkError(err2, w, r) {
      if (err2) {
        err2.stack;
        if (w && !w.errored) {
          w.errored = err2;
        }
        if (r && !r.errored) {
          r.errored = err2;
        }
      }
    }
    function destroy(err2, cb) {
      const r = this._readableState;
      const w = this._writableState;
      const s = w || r;
      if (w !== null && w !== void 0 && w.destroyed || r !== null && r !== void 0 && r.destroyed) {
        if (typeof cb === "function") {
          cb();
        }
        return this;
      }
      checkError(err2, w, r);
      if (w) {
        w.destroyed = true;
      }
      if (r) {
        r.destroyed = true;
      }
      if (!s.constructed) {
        this.once(kDestroy, function(er) {
          _destroy(this, aggregateTwoErrors(er, err2), cb);
        });
      } else {
        _destroy(this, err2, cb);
      }
      return this;
    }
    function _destroy(self, err2, cb) {
      let called = false;
      function onDestroy(err3) {
        if (called) {
          return;
        }
        called = true;
        const r = self._readableState;
        const w = self._writableState;
        checkError(err3, w, r);
        if (w) {
          w.closed = true;
        }
        if (r) {
          r.closed = true;
        }
        if (typeof cb === "function") {
          cb(err3);
        }
        if (err3) {
          process2.nextTick(emitErrorCloseNT, self, err3);
        } else {
          process2.nextTick(emitCloseNT, self);
        }
      }
      try {
        self._destroy(err2 || null, onDestroy);
      } catch (err3) {
        onDestroy(err3);
      }
    }
    function emitErrorCloseNT(self, err2) {
      emitErrorNT(self, err2);
      emitCloseNT(self);
    }
    function emitCloseNT(self) {
      const r = self._readableState;
      const w = self._writableState;
      if (w) {
        w.closeEmitted = true;
      }
      if (r) {
        r.closeEmitted = true;
      }
      if (w !== null && w !== void 0 && w.emitClose || r !== null && r !== void 0 && r.emitClose) {
        self.emit("close");
      }
    }
    function emitErrorNT(self, err2) {
      const r = self._readableState;
      const w = self._writableState;
      if (w !== null && w !== void 0 && w.errorEmitted || r !== null && r !== void 0 && r.errorEmitted) {
        return;
      }
      if (w) {
        w.errorEmitted = true;
      }
      if (r) {
        r.errorEmitted = true;
      }
      self.emit("error", err2);
    }
    function undestroy() {
      const r = this._readableState;
      const w = this._writableState;
      if (r) {
        r.constructed = true;
        r.closed = false;
        r.closeEmitted = false;
        r.destroyed = false;
        r.errored = null;
        r.errorEmitted = false;
        r.reading = false;
        r.ended = r.readable === false;
        r.endEmitted = r.readable === false;
      }
      if (w) {
        w.constructed = true;
        w.destroyed = false;
        w.closed = false;
        w.closeEmitted = false;
        w.errored = null;
        w.errorEmitted = false;
        w.finalCalled = false;
        w.prefinished = false;
        w.ended = w.writable === false;
        w.ending = w.writable === false;
        w.finished = w.writable === false;
      }
    }
    function errorOrDestroy(stream, err2, sync) {
      const r = stream._readableState;
      const w = stream._writableState;
      if (w !== null && w !== void 0 && w.destroyed || r !== null && r !== void 0 && r.destroyed) {
        return this;
      }
      if (r !== null && r !== void 0 && r.autoDestroy || w !== null && w !== void 0 && w.autoDestroy)
        stream.destroy(err2);
      else if (err2) {
        err2.stack;
        if (w && !w.errored) {
          w.errored = err2;
        }
        if (r && !r.errored) {
          r.errored = err2;
        }
        if (sync) {
          process2.nextTick(emitErrorNT, stream, err2);
        } else {
          emitErrorNT(stream, err2);
        }
      }
    }
    function construct(stream, cb) {
      if (typeof stream._construct !== "function") {
        return;
      }
      const r = stream._readableState;
      const w = stream._writableState;
      if (r) {
        r.constructed = false;
      }
      if (w) {
        w.constructed = false;
      }
      stream.once(kConstruct, cb);
      if (stream.listenerCount(kConstruct) > 1) {
        return;
      }
      process2.nextTick(constructNT, stream);
    }
    function constructNT(stream) {
      let called = false;
      function onConstruct(err2) {
        if (called) {
          errorOrDestroy(stream, err2 !== null && err2 !== void 0 ? err2 : new ERR_MULTIPLE_CALLBACK());
          return;
        }
        called = true;
        const r = stream._readableState;
        const w = stream._writableState;
        const s = w || r;
        if (r) {
          r.constructed = true;
        }
        if (w) {
          w.constructed = true;
        }
        if (s.destroyed) {
          stream.emit(kDestroy, err2);
        } else if (err2) {
          errorOrDestroy(stream, err2, true);
        } else {
          process2.nextTick(emitConstructNT, stream);
        }
      }
      try {
        stream._construct((err2) => {
          process2.nextTick(onConstruct, err2);
        });
      } catch (err2) {
        process2.nextTick(onConstruct, err2);
      }
    }
    function emitConstructNT(stream) {
      stream.emit(kConstruct);
    }
    function isRequest(stream) {
      return (stream === null || stream === void 0 ? void 0 : stream.setHeader) && typeof stream.abort === "function";
    }
    function emitCloseLegacy(stream) {
      stream.emit("close");
    }
    function emitErrorCloseLegacy(stream, err2) {
      stream.emit("error", err2);
      process2.nextTick(emitCloseLegacy, stream);
    }
    function destroyer(stream, err2) {
      if (!stream || isDestroyed(stream)) {
        return;
      }
      if (!err2 && !isFinished(stream)) {
        err2 = new AbortError();
      }
      if (isServerRequest(stream)) {
        stream.socket = null;
        stream.destroy(err2);
      } else if (isRequest(stream)) {
        stream.abort();
      } else if (isRequest(stream.req)) {
        stream.req.abort();
      } else if (typeof stream.destroy === "function") {
        stream.destroy(err2);
      } else if (typeof stream.close === "function") {
        stream.close();
      } else if (err2) {
        process2.nextTick(emitErrorCloseLegacy, stream, err2);
      } else {
        process2.nextTick(emitCloseLegacy, stream);
      }
      if (!stream.destroyed) {
        stream[kIsDestroyed] = true;
      }
    }
    module.exports = {
      construct,
      destroyer,
      destroy,
      undestroy,
      errorOrDestroy
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/legacy.js
var require_legacy = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/legacy.js"(exports, module) {
    "use strict";
    var { ArrayIsArray, ObjectSetPrototypeOf } = require_primordials();
    var { EventEmitter: EE } = __require("events");
    function Stream(opts) {
      EE.call(this, opts);
    }
    ObjectSetPrototypeOf(Stream.prototype, EE.prototype);
    ObjectSetPrototypeOf(Stream, EE);
    Stream.prototype.pipe = function(dest, options) {
      const source = this;
      function ondata(chunk) {
        if (dest.writable && dest.write(chunk) === false && source.pause) {
          source.pause();
        }
      }
      source.on("data", ondata);
      function ondrain() {
        if (source.readable && source.resume) {
          source.resume();
        }
      }
      dest.on("drain", ondrain);
      if (!dest._isStdio && (!options || options.end !== false)) {
        source.on("end", onend);
        source.on("close", onclose);
      }
      let didOnEnd = false;
      function onend() {
        if (didOnEnd) return;
        didOnEnd = true;
        dest.end();
      }
      function onclose() {
        if (didOnEnd) return;
        didOnEnd = true;
        if (typeof dest.destroy === "function") dest.destroy();
      }
      function onerror(er) {
        cleanup();
        if (EE.listenerCount(this, "error") === 0) {
          this.emit("error", er);
        }
      }
      prependListener(source, "error", onerror);
      prependListener(dest, "error", onerror);
      function cleanup() {
        source.removeListener("data", ondata);
        dest.removeListener("drain", ondrain);
        source.removeListener("end", onend);
        source.removeListener("close", onclose);
        source.removeListener("error", onerror);
        dest.removeListener("error", onerror);
        source.removeListener("end", cleanup);
        source.removeListener("close", cleanup);
        dest.removeListener("close", cleanup);
      }
      source.on("end", cleanup);
      source.on("close", cleanup);
      dest.on("close", cleanup);
      dest.emit("pipe", source);
      return dest;
    };
    function prependListener(emitter, event, fn) {
      if (typeof emitter.prependListener === "function") return emitter.prependListener(event, fn);
      if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);
      else if (ArrayIsArray(emitter._events[event])) emitter._events[event].unshift(fn);
      else emitter._events[event] = [fn, emitter._events[event]];
    }
    module.exports = {
      Stream,
      prependListener
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/add-abort-signal.js
var require_add_abort_signal = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/add-abort-signal.js"(exports, module) {
    "use strict";
    var { SymbolDispose } = require_primordials();
    var { AbortError, codes } = require_errors();
    var { isNodeStream, isWebStream, kControllerErrorFunction } = require_utils();
    var eos = require_end_of_stream();
    var { ERR_INVALID_ARG_TYPE } = codes;
    var addAbortListener;
    var validateAbortSignal = (signal, name) => {
      if (typeof signal !== "object" || !("aborted" in signal)) {
        throw new ERR_INVALID_ARG_TYPE(name, "AbortSignal", signal);
      }
    };
    module.exports.addAbortSignal = function addAbortSignal(signal, stream) {
      validateAbortSignal(signal, "signal");
      if (!isNodeStream(stream) && !isWebStream(stream)) {
        throw new ERR_INVALID_ARG_TYPE("stream", ["ReadableStream", "WritableStream", "Stream"], stream);
      }
      return module.exports.addAbortSignalNoValidate(signal, stream);
    };
    module.exports.addAbortSignalNoValidate = function(signal, stream) {
      if (typeof signal !== "object" || !("aborted" in signal)) {
        return stream;
      }
      const onAbort = isNodeStream(stream) ? () => {
        stream.destroy(
          new AbortError(void 0, {
            cause: signal.reason
          })
        );
      } : () => {
        stream[kControllerErrorFunction](
          new AbortError(void 0, {
            cause: signal.reason
          })
        );
      };
      if (signal.aborted) {
        onAbort();
      } else {
        addAbortListener = addAbortListener || require_util().addAbortListener;
        const disposable = addAbortListener(signal, onAbort);
        eos(stream, disposable[SymbolDispose]);
      }
      return stream;
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/buffer_list.js
var require_buffer_list = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/buffer_list.js"(exports, module) {
    "use strict";
    var { StringPrototypeSlice, SymbolIterator, TypedArrayPrototypeSet, Uint8Array: Uint8Array2 } = require_primordials();
    var { Buffer: Buffer2 } = __require("buffer");
    var { inspect } = require_util();
    module.exports = class BufferList {
      constructor() {
        this.head = null;
        this.tail = null;
        this.length = 0;
      }
      push(v) {
        const entry = {
          data: v,
          next: null
        };
        if (this.length > 0) this.tail.next = entry;
        else this.head = entry;
        this.tail = entry;
        ++this.length;
      }
      unshift(v) {
        const entry = {
          data: v,
          next: this.head
        };
        if (this.length === 0) this.tail = entry;
        this.head = entry;
        ++this.length;
      }
      shift() {
        if (this.length === 0) return;
        const ret = this.head.data;
        if (this.length === 1) this.head = this.tail = null;
        else this.head = this.head.next;
        --this.length;
        return ret;
      }
      clear() {
        this.head = this.tail = null;
        this.length = 0;
      }
      join(s) {
        if (this.length === 0) return "";
        let p = this.head;
        let ret = "" + p.data;
        while ((p = p.next) !== null) ret += s + p.data;
        return ret;
      }
      concat(n) {
        if (this.length === 0) return Buffer2.alloc(0);
        const ret = Buffer2.allocUnsafe(n >>> 0);
        let p = this.head;
        let i = 0;
        while (p) {
          TypedArrayPrototypeSet(ret, p.data, i);
          i += p.data.length;
          p = p.next;
        }
        return ret;
      }
      // Consumes a specified amount of bytes or characters from the buffered data.
      consume(n, hasStrings) {
        const data = this.head.data;
        if (n < data.length) {
          const slice = data.slice(0, n);
          this.head.data = data.slice(n);
          return slice;
        }
        if (n === data.length) {
          return this.shift();
        }
        return hasStrings ? this._getString(n) : this._getBuffer(n);
      }
      first() {
        return this.head.data;
      }
      *[SymbolIterator]() {
        for (let p = this.head; p; p = p.next) {
          yield p.data;
        }
      }
      // Consumes a specified amount of characters from the buffered data.
      _getString(n) {
        let ret = "";
        let p = this.head;
        let c = 0;
        do {
          const str = p.data;
          if (n > str.length) {
            ret += str;
            n -= str.length;
          } else {
            if (n === str.length) {
              ret += str;
              ++c;
              if (p.next) this.head = p.next;
              else this.head = this.tail = null;
            } else {
              ret += StringPrototypeSlice(str, 0, n);
              this.head = p;
              p.data = StringPrototypeSlice(str, n);
            }
            break;
          }
          ++c;
        } while ((p = p.next) !== null);
        this.length -= c;
        return ret;
      }
      // Consumes a specified amount of bytes from the buffered data.
      _getBuffer(n) {
        const ret = Buffer2.allocUnsafe(n);
        const retLen = n;
        let p = this.head;
        let c = 0;
        do {
          const buf = p.data;
          if (n > buf.length) {
            TypedArrayPrototypeSet(ret, buf, retLen - n);
            n -= buf.length;
          } else {
            if (n === buf.length) {
              TypedArrayPrototypeSet(ret, buf, retLen - n);
              ++c;
              if (p.next) this.head = p.next;
              else this.head = this.tail = null;
            } else {
              TypedArrayPrototypeSet(ret, new Uint8Array2(buf.buffer, buf.byteOffset, n), retLen - n);
              this.head = p;
              p.data = buf.slice(n);
            }
            break;
          }
          ++c;
        } while ((p = p.next) !== null);
        this.length -= c;
        return ret;
      }
      // Make sure the linked list only shows the minimal necessary information.
      [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")](_, options) {
        return inspect(this, {
          ...options,
          // Only inspect one level.
          depth: 0,
          // It should not recurse.
          customInspect: false
        });
      }
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/state.js
var require_state = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/state.js"(exports, module) {
    "use strict";
    var { MathFloor, NumberIsInteger } = require_primordials();
    var { validateInteger } = require_validators();
    var { ERR_INVALID_ARG_VALUE } = require_errors().codes;
    var defaultHighWaterMarkBytes = 16 * 1024;
    var defaultHighWaterMarkObjectMode = 16;
    function highWaterMarkFrom(options, isDuplex, duplexKey) {
      return options.highWaterMark != null ? options.highWaterMark : isDuplex ? options[duplexKey] : null;
    }
    function getDefaultHighWaterMark(objectMode) {
      return objectMode ? defaultHighWaterMarkObjectMode : defaultHighWaterMarkBytes;
    }
    function setDefaultHighWaterMark(objectMode, value) {
      validateInteger(value, "value", 0);
      if (objectMode) {
        defaultHighWaterMarkObjectMode = value;
      } else {
        defaultHighWaterMarkBytes = value;
      }
    }
    function getHighWaterMark(state, options, duplexKey, isDuplex) {
      const hwm = highWaterMarkFrom(options, isDuplex, duplexKey);
      if (hwm != null) {
        if (!NumberIsInteger(hwm) || hwm < 0) {
          const name = isDuplex ? `options.${duplexKey}` : "options.highWaterMark";
          throw new ERR_INVALID_ARG_VALUE(name, hwm);
        }
        return MathFloor(hwm);
      }
      return getDefaultHighWaterMark(state.objectMode);
    }
    module.exports = {
      getHighWaterMark,
      getDefaultHighWaterMark,
      setDefaultHighWaterMark
    };
  }
});

// ../../node_modules/.pnpm/safe-buffer@5.2.1/node_modules/safe-buffer/index.js
var require_safe_buffer = __commonJS({
  "../../node_modules/.pnpm/safe-buffer@5.2.1/node_modules/safe-buffer/index.js"(exports, module) {
    var buffer = __require("buffer");
    var Buffer2 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src) {
        dst[key] = src[key];
      }
    }
    if (Buffer2.from && Buffer2.alloc && Buffer2.allocUnsafe && Buffer2.allocUnsafeSlow) {
      module.exports = buffer;
    } else {
      copyProps(buffer, exports);
      exports.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer2(arg, encodingOrOffset, length);
    }
    SafeBuffer.prototype = Object.create(Buffer2.prototype);
    copyProps(Buffer2, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer2(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer2(size);
      if (fill !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill, encoding);
        } else {
          buf.fill(fill);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer2(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  }
});

// ../../node_modules/.pnpm/string_decoder@1.3.0/node_modules/string_decoder/lib/string_decoder.js
var require_string_decoder = __commonJS({
  "../../node_modules/.pnpm/string_decoder@1.3.0/node_modules/string_decoder/lib/string_decoder.js"(exports) {
    "use strict";
    var Buffer2 = require_safe_buffer().Buffer;
    var isEncoding = Buffer2.isEncoding || function(encoding) {
      encoding = "" + encoding;
      switch (encoding && encoding.toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
        case "raw":
          return true;
        default:
          return false;
      }
    };
    function _normalizeEncoding(enc) {
      if (!enc) return "utf8";
      var retried;
      while (true) {
        switch (enc) {
          case "utf8":
          case "utf-8":
            return "utf8";
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return "utf16le";
          case "latin1":
          case "binary":
            return "latin1";
          case "base64":
          case "ascii":
          case "hex":
            return enc;
          default:
            if (retried) return;
            enc = ("" + enc).toLowerCase();
            retried = true;
        }
      }
    }
    function normalizeEncoding(enc) {
      var nenc = _normalizeEncoding(enc);
      if (typeof nenc !== "string" && (Buffer2.isEncoding === isEncoding || !isEncoding(enc))) throw new Error("Unknown encoding: " + enc);
      return nenc || enc;
    }
    exports.StringDecoder = StringDecoder;
    function StringDecoder(encoding) {
      this.encoding = normalizeEncoding(encoding);
      var nb;
      switch (this.encoding) {
        case "utf16le":
          this.text = utf16Text;
          this.end = utf16End;
          nb = 4;
          break;
        case "utf8":
          this.fillLast = utf8FillLast;
          nb = 4;
          break;
        case "base64":
          this.text = base64Text;
          this.end = base64End;
          nb = 3;
          break;
        default:
          this.write = simpleWrite;
          this.end = simpleEnd;
          return;
      }
      this.lastNeed = 0;
      this.lastTotal = 0;
      this.lastChar = Buffer2.allocUnsafe(nb);
    }
    StringDecoder.prototype.write = function(buf) {
      if (buf.length === 0) return "";
      var r;
      var i;
      if (this.lastNeed) {
        r = this.fillLast(buf);
        if (r === void 0) return "";
        i = this.lastNeed;
        this.lastNeed = 0;
      } else {
        i = 0;
      }
      if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
      return r || "";
    };
    StringDecoder.prototype.end = utf8End;
    StringDecoder.prototype.text = utf8Text;
    StringDecoder.prototype.fillLast = function(buf) {
      if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
      }
      buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
      this.lastNeed -= buf.length;
    };
    function utf8CheckByte(byte) {
      if (byte <= 127) return 0;
      else if (byte >> 5 === 6) return 2;
      else if (byte >> 4 === 14) return 3;
      else if (byte >> 3 === 30) return 4;
      return byte >> 6 === 2 ? -1 : -2;
    }
    function utf8CheckIncomplete(self, buf, i) {
      var j = buf.length - 1;
      if (j < i) return 0;
      var nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) self.lastNeed = nb - 1;
        return nb;
      }
      if (--j < i || nb === -2) return 0;
      nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) self.lastNeed = nb - 2;
        return nb;
      }
      if (--j < i || nb === -2) return 0;
      nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) {
          if (nb === 2) nb = 0;
          else self.lastNeed = nb - 3;
        }
        return nb;
      }
      return 0;
    }
    function utf8CheckExtraBytes(self, buf, p) {
      if ((buf[0] & 192) !== 128) {
        self.lastNeed = 0;
        return "\uFFFD";
      }
      if (self.lastNeed > 1 && buf.length > 1) {
        if ((buf[1] & 192) !== 128) {
          self.lastNeed = 1;
          return "\uFFFD";
        }
        if (self.lastNeed > 2 && buf.length > 2) {
          if ((buf[2] & 192) !== 128) {
            self.lastNeed = 2;
            return "\uFFFD";
          }
        }
      }
    }
    function utf8FillLast(buf) {
      var p = this.lastTotal - this.lastNeed;
      var r = utf8CheckExtraBytes(this, buf, p);
      if (r !== void 0) return r;
      if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, p, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
      }
      buf.copy(this.lastChar, p, 0, buf.length);
      this.lastNeed -= buf.length;
    }
    function utf8Text(buf, i) {
      var total = utf8CheckIncomplete(this, buf, i);
      if (!this.lastNeed) return buf.toString("utf8", i);
      this.lastTotal = total;
      var end = buf.length - (total - this.lastNeed);
      buf.copy(this.lastChar, 0, end);
      return buf.toString("utf8", i, end);
    }
    function utf8End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) return r + "\uFFFD";
      return r;
    }
    function utf16Text(buf, i) {
      if ((buf.length - i) % 2 === 0) {
        var r = buf.toString("utf16le", i);
        if (r) {
          var c = r.charCodeAt(r.length - 1);
          if (c >= 55296 && c <= 56319) {
            this.lastNeed = 2;
            this.lastTotal = 4;
            this.lastChar[0] = buf[buf.length - 2];
            this.lastChar[1] = buf[buf.length - 1];
            return r.slice(0, -1);
          }
        }
        return r;
      }
      this.lastNeed = 1;
      this.lastTotal = 2;
      this.lastChar[0] = buf[buf.length - 1];
      return buf.toString("utf16le", i, buf.length - 1);
    }
    function utf16End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) {
        var end = this.lastTotal - this.lastNeed;
        return r + this.lastChar.toString("utf16le", 0, end);
      }
      return r;
    }
    function base64Text(buf, i) {
      var n = (buf.length - i) % 3;
      if (n === 0) return buf.toString("base64", i);
      this.lastNeed = 3 - n;
      this.lastTotal = 3;
      if (n === 1) {
        this.lastChar[0] = buf[buf.length - 1];
      } else {
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
      }
      return buf.toString("base64", i, buf.length - n);
    }
    function base64End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
      return r;
    }
    function simpleWrite(buf) {
      return buf.toString(this.encoding);
    }
    function simpleEnd(buf) {
      return buf && buf.length ? this.write(buf) : "";
    }
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/from.js
var require_from = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/from.js"(exports, module) {
    "use strict";
    var process2 = require_process();
    var { PromisePrototypeThen, SymbolAsyncIterator, SymbolIterator } = require_primordials();
    var { Buffer: Buffer2 } = __require("buffer");
    var { ERR_INVALID_ARG_TYPE, ERR_STREAM_NULL_VALUES } = require_errors().codes;
    function from(Readable, iterable, opts) {
      let iterator;
      if (typeof iterable === "string" || iterable instanceof Buffer2) {
        return new Readable({
          objectMode: true,
          ...opts,
          read() {
            this.push(iterable);
            this.push(null);
          }
        });
      }
      let isAsync;
      if (iterable && iterable[SymbolAsyncIterator]) {
        isAsync = true;
        iterator = iterable[SymbolAsyncIterator]();
      } else if (iterable && iterable[SymbolIterator]) {
        isAsync = false;
        iterator = iterable[SymbolIterator]();
      } else {
        throw new ERR_INVALID_ARG_TYPE("iterable", ["Iterable"], iterable);
      }
      const readable = new Readable({
        objectMode: true,
        highWaterMark: 1,
        // TODO(ronag): What options should be allowed?
        ...opts
      });
      let reading = false;
      readable._read = function() {
        if (!reading) {
          reading = true;
          next();
        }
      };
      readable._destroy = function(error2, cb) {
        PromisePrototypeThen(
          close(error2),
          () => process2.nextTick(cb, error2),
          // nextTick is here in case cb throws
          (e) => process2.nextTick(cb, e || error2)
        );
      };
      async function close(error2) {
        const hadError = error2 !== void 0 && error2 !== null;
        const hasThrow = typeof iterator.throw === "function";
        if (hadError && hasThrow) {
          const { value, done } = await iterator.throw(error2);
          await value;
          if (done) {
            return;
          }
        }
        if (typeof iterator.return === "function") {
          const { value } = await iterator.return();
          await value;
        }
      }
      async function next() {
        for (; ; ) {
          try {
            const { value, done } = isAsync ? await iterator.next() : iterator.next();
            if (done) {
              readable.push(null);
            } else {
              const res = value && typeof value.then === "function" ? await value : value;
              if (res === null) {
                reading = false;
                throw new ERR_STREAM_NULL_VALUES();
              } else if (readable.push(res)) {
                continue;
              } else {
                reading = false;
              }
            }
          } catch (err2) {
            readable.destroy(err2);
          }
          break;
        }
      }
      return readable;
    }
    module.exports = from;
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/readable.js
var require_readable = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/readable.js"(exports, module) {
    "use strict";
    var process2 = require_process();
    var {
      ArrayPrototypeIndexOf,
      NumberIsInteger,
      NumberIsNaN,
      NumberParseInt,
      ObjectDefineProperties,
      ObjectKeys,
      ObjectSetPrototypeOf,
      Promise: Promise2,
      SafeSet,
      SymbolAsyncDispose,
      SymbolAsyncIterator,
      Symbol: Symbol2
    } = require_primordials();
    module.exports = Readable;
    Readable.ReadableState = ReadableState;
    var { EventEmitter: EE } = __require("events");
    var { Stream, prependListener } = require_legacy();
    var { Buffer: Buffer2 } = __require("buffer");
    var { addAbortSignal } = require_add_abort_signal();
    var eos = require_end_of_stream();
    var debug2 = require_util().debuglog("stream", (fn) => {
      debug2 = fn;
    });
    var BufferList = require_buffer_list();
    var destroyImpl = require_destroy();
    var { getHighWaterMark, getDefaultHighWaterMark } = require_state();
    var {
      aggregateTwoErrors,
      codes: {
        ERR_INVALID_ARG_TYPE,
        ERR_METHOD_NOT_IMPLEMENTED,
        ERR_OUT_OF_RANGE,
        ERR_STREAM_PUSH_AFTER_EOF,
        ERR_STREAM_UNSHIFT_AFTER_END_EVENT
      },
      AbortError
    } = require_errors();
    var { validateObject } = require_validators();
    var kPaused = Symbol2("kPaused");
    var { StringDecoder } = require_string_decoder();
    var from = require_from();
    ObjectSetPrototypeOf(Readable.prototype, Stream.prototype);
    ObjectSetPrototypeOf(Readable, Stream);
    var nop = () => {
    };
    var { errorOrDestroy } = destroyImpl;
    var kObjectMode = 1 << 0;
    var kEnded = 1 << 1;
    var kEndEmitted = 1 << 2;
    var kReading = 1 << 3;
    var kConstructed = 1 << 4;
    var kSync = 1 << 5;
    var kNeedReadable = 1 << 6;
    var kEmittedReadable = 1 << 7;
    var kReadableListening = 1 << 8;
    var kResumeScheduled = 1 << 9;
    var kErrorEmitted = 1 << 10;
    var kEmitClose = 1 << 11;
    var kAutoDestroy = 1 << 12;
    var kDestroyed = 1 << 13;
    var kClosed = 1 << 14;
    var kCloseEmitted = 1 << 15;
    var kMultiAwaitDrain = 1 << 16;
    var kReadingMore = 1 << 17;
    var kDataEmitted = 1 << 18;
    function makeBitMapDescriptor(bit) {
      return {
        enumerable: false,
        get() {
          return (this.state & bit) !== 0;
        },
        set(value) {
          if (value) this.state |= bit;
          else this.state &= ~bit;
        }
      };
    }
    ObjectDefineProperties(ReadableState.prototype, {
      objectMode: makeBitMapDescriptor(kObjectMode),
      ended: makeBitMapDescriptor(kEnded),
      endEmitted: makeBitMapDescriptor(kEndEmitted),
      reading: makeBitMapDescriptor(kReading),
      // Stream is still being constructed and cannot be
      // destroyed until construction finished or failed.
      // Async construction is opt in, therefore we start as
      // constructed.
      constructed: makeBitMapDescriptor(kConstructed),
      // A flag to be able to tell if the event 'readable'/'data' is emitted
      // immediately, or on a later tick.  We set this to true at first, because
      // any actions that shouldn't happen until "later" should generally also
      // not happen before the first read call.
      sync: makeBitMapDescriptor(kSync),
      // Whenever we return null, then we set a flag to say
      // that we're awaiting a 'readable' event emission.
      needReadable: makeBitMapDescriptor(kNeedReadable),
      emittedReadable: makeBitMapDescriptor(kEmittedReadable),
      readableListening: makeBitMapDescriptor(kReadableListening),
      resumeScheduled: makeBitMapDescriptor(kResumeScheduled),
      // True if the error was already emitted and should not be thrown again.
      errorEmitted: makeBitMapDescriptor(kErrorEmitted),
      emitClose: makeBitMapDescriptor(kEmitClose),
      autoDestroy: makeBitMapDescriptor(kAutoDestroy),
      // Has it been destroyed.
      destroyed: makeBitMapDescriptor(kDestroyed),
      // Indicates whether the stream has finished destroying.
      closed: makeBitMapDescriptor(kClosed),
      // True if close has been emitted or would have been emitted
      // depending on emitClose.
      closeEmitted: makeBitMapDescriptor(kCloseEmitted),
      multiAwaitDrain: makeBitMapDescriptor(kMultiAwaitDrain),
      // If true, a maybeReadMore has been scheduled.
      readingMore: makeBitMapDescriptor(kReadingMore),
      dataEmitted: makeBitMapDescriptor(kDataEmitted)
    });
    function ReadableState(options, stream, isDuplex) {
      if (typeof isDuplex !== "boolean") isDuplex = stream instanceof require_duplex();
      this.state = kEmitClose | kAutoDestroy | kConstructed | kSync;
      if (options && options.objectMode) this.state |= kObjectMode;
      if (isDuplex && options && options.readableObjectMode) this.state |= kObjectMode;
      this.highWaterMark = options ? getHighWaterMark(this, options, "readableHighWaterMark", isDuplex) : getDefaultHighWaterMark(false);
      this.buffer = new BufferList();
      this.length = 0;
      this.pipes = [];
      this.flowing = null;
      this[kPaused] = null;
      if (options && options.emitClose === false) this.state &= ~kEmitClose;
      if (options && options.autoDestroy === false) this.state &= ~kAutoDestroy;
      this.errored = null;
      this.defaultEncoding = options && options.defaultEncoding || "utf8";
      this.awaitDrainWriters = null;
      this.decoder = null;
      this.encoding = null;
      if (options && options.encoding) {
        this.decoder = new StringDecoder(options.encoding);
        this.encoding = options.encoding;
      }
    }
    function Readable(options) {
      if (!(this instanceof Readable)) return new Readable(options);
      const isDuplex = this instanceof require_duplex();
      this._readableState = new ReadableState(options, this, isDuplex);
      if (options) {
        if (typeof options.read === "function") this._read = options.read;
        if (typeof options.destroy === "function") this._destroy = options.destroy;
        if (typeof options.construct === "function") this._construct = options.construct;
        if (options.signal && !isDuplex) addAbortSignal(options.signal, this);
      }
      Stream.call(this, options);
      destroyImpl.construct(this, () => {
        if (this._readableState.needReadable) {
          maybeReadMore(this, this._readableState);
        }
      });
    }
    Readable.prototype.destroy = destroyImpl.destroy;
    Readable.prototype._undestroy = destroyImpl.undestroy;
    Readable.prototype._destroy = function(err2, cb) {
      cb(err2);
    };
    Readable.prototype[EE.captureRejectionSymbol] = function(err2) {
      this.destroy(err2);
    };
    Readable.prototype[SymbolAsyncDispose] = function() {
      let error2;
      if (!this.destroyed) {
        error2 = this.readableEnded ? null : new AbortError();
        this.destroy(error2);
      }
      return new Promise2((resolve3, reject) => eos(this, (err2) => err2 && err2 !== error2 ? reject(err2) : resolve3(null)));
    };
    Readable.prototype.push = function(chunk, encoding) {
      return readableAddChunk(this, chunk, encoding, false);
    };
    Readable.prototype.unshift = function(chunk, encoding) {
      return readableAddChunk(this, chunk, encoding, true);
    };
    function readableAddChunk(stream, chunk, encoding, addToFront) {
      debug2("readableAddChunk", chunk);
      const state = stream._readableState;
      let err2;
      if ((state.state & kObjectMode) === 0) {
        if (typeof chunk === "string") {
          encoding = encoding || state.defaultEncoding;
          if (state.encoding !== encoding) {
            if (addToFront && state.encoding) {
              chunk = Buffer2.from(chunk, encoding).toString(state.encoding);
            } else {
              chunk = Buffer2.from(chunk, encoding);
              encoding = "";
            }
          }
        } else if (chunk instanceof Buffer2) {
          encoding = "";
        } else if (Stream._isUint8Array(chunk)) {
          chunk = Stream._uint8ArrayToBuffer(chunk);
          encoding = "";
        } else if (chunk != null) {
          err2 = new ERR_INVALID_ARG_TYPE("chunk", ["string", "Buffer", "Uint8Array"], chunk);
        }
      }
      if (err2) {
        errorOrDestroy(stream, err2);
      } else if (chunk === null) {
        state.state &= ~kReading;
        onEofChunk(stream, state);
      } else if ((state.state & kObjectMode) !== 0 || chunk && chunk.length > 0) {
        if (addToFront) {
          if ((state.state & kEndEmitted) !== 0) errorOrDestroy(stream, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT());
          else if (state.destroyed || state.errored) return false;
          else addChunk(stream, state, chunk, true);
        } else if (state.ended) {
          errorOrDestroy(stream, new ERR_STREAM_PUSH_AFTER_EOF());
        } else if (state.destroyed || state.errored) {
          return false;
        } else {
          state.state &= ~kReading;
          if (state.decoder && !encoding) {
            chunk = state.decoder.write(chunk);
            if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);
            else maybeReadMore(stream, state);
          } else {
            addChunk(stream, state, chunk, false);
          }
        }
      } else if (!addToFront) {
        state.state &= ~kReading;
        maybeReadMore(stream, state);
      }
      return !state.ended && (state.length < state.highWaterMark || state.length === 0);
    }
    function addChunk(stream, state, chunk, addToFront) {
      if (state.flowing && state.length === 0 && !state.sync && stream.listenerCount("data") > 0) {
        if ((state.state & kMultiAwaitDrain) !== 0) {
          state.awaitDrainWriters.clear();
        } else {
          state.awaitDrainWriters = null;
        }
        state.dataEmitted = true;
        stream.emit("data", chunk);
      } else {
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront) state.buffer.unshift(chunk);
        else state.buffer.push(chunk);
        if ((state.state & kNeedReadable) !== 0) emitReadable(stream);
      }
      maybeReadMore(stream, state);
    }
    Readable.prototype.isPaused = function() {
      const state = this._readableState;
      return state[kPaused] === true || state.flowing === false;
    };
    Readable.prototype.setEncoding = function(enc) {
      const decoder = new StringDecoder(enc);
      this._readableState.decoder = decoder;
      this._readableState.encoding = this._readableState.decoder.encoding;
      const buffer = this._readableState.buffer;
      let content = "";
      for (const data of buffer) {
        content += decoder.write(data);
      }
      buffer.clear();
      if (content !== "") buffer.push(content);
      this._readableState.length = content.length;
      return this;
    };
    var MAX_HWM = 1073741824;
    function computeNewHighWaterMark(n) {
      if (n > MAX_HWM) {
        throw new ERR_OUT_OF_RANGE("size", "<= 1GiB", n);
      } else {
        n--;
        n |= n >>> 1;
        n |= n >>> 2;
        n |= n >>> 4;
        n |= n >>> 8;
        n |= n >>> 16;
        n++;
      }
      return n;
    }
    function howMuchToRead(n, state) {
      if (n <= 0 || state.length === 0 && state.ended) return 0;
      if ((state.state & kObjectMode) !== 0) return 1;
      if (NumberIsNaN(n)) {
        if (state.flowing && state.length) return state.buffer.first().length;
        return state.length;
      }
      if (n <= state.length) return n;
      return state.ended ? state.length : 0;
    }
    Readable.prototype.read = function(n) {
      debug2("read", n);
      if (n === void 0) {
        n = NaN;
      } else if (!NumberIsInteger(n)) {
        n = NumberParseInt(n, 10);
      }
      const state = this._readableState;
      const nOrig = n;
      if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
      if (n !== 0) state.state &= ~kEmittedReadable;
      if (n === 0 && state.needReadable && ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || state.ended)) {
        debug2("read: emitReadable", state.length, state.ended);
        if (state.length === 0 && state.ended) endReadable(this);
        else emitReadable(this);
        return null;
      }
      n = howMuchToRead(n, state);
      if (n === 0 && state.ended) {
        if (state.length === 0) endReadable(this);
        return null;
      }
      let doRead = (state.state & kNeedReadable) !== 0;
      debug2("need readable", doRead);
      if (state.length === 0 || state.length - n < state.highWaterMark) {
        doRead = true;
        debug2("length less than watermark", doRead);
      }
      if (state.ended || state.reading || state.destroyed || state.errored || !state.constructed) {
        doRead = false;
        debug2("reading, ended or constructing", doRead);
      } else if (doRead) {
        debug2("do read");
        state.state |= kReading | kSync;
        if (state.length === 0) state.state |= kNeedReadable;
        try {
          this._read(state.highWaterMark);
        } catch (err2) {
          errorOrDestroy(this, err2);
        }
        state.state &= ~kSync;
        if (!state.reading) n = howMuchToRead(nOrig, state);
      }
      let ret;
      if (n > 0) ret = fromList(n, state);
      else ret = null;
      if (ret === null) {
        state.needReadable = state.length <= state.highWaterMark;
        n = 0;
      } else {
        state.length -= n;
        if (state.multiAwaitDrain) {
          state.awaitDrainWriters.clear();
        } else {
          state.awaitDrainWriters = null;
        }
      }
      if (state.length === 0) {
        if (!state.ended) state.needReadable = true;
        if (nOrig !== n && state.ended) endReadable(this);
      }
      if (ret !== null && !state.errorEmitted && !state.closeEmitted) {
        state.dataEmitted = true;
        this.emit("data", ret);
      }
      return ret;
    };
    function onEofChunk(stream, state) {
      debug2("onEofChunk");
      if (state.ended) return;
      if (state.decoder) {
        const chunk = state.decoder.end();
        if (chunk && chunk.length) {
          state.buffer.push(chunk);
          state.length += state.objectMode ? 1 : chunk.length;
        }
      }
      state.ended = true;
      if (state.sync) {
        emitReadable(stream);
      } else {
        state.needReadable = false;
        state.emittedReadable = true;
        emitReadable_(stream);
      }
    }
    function emitReadable(stream) {
      const state = stream._readableState;
      debug2("emitReadable", state.needReadable, state.emittedReadable);
      state.needReadable = false;
      if (!state.emittedReadable) {
        debug2("emitReadable", state.flowing);
        state.emittedReadable = true;
        process2.nextTick(emitReadable_, stream);
      }
    }
    function emitReadable_(stream) {
      const state = stream._readableState;
      debug2("emitReadable_", state.destroyed, state.length, state.ended);
      if (!state.destroyed && !state.errored && (state.length || state.ended)) {
        stream.emit("readable");
        state.emittedReadable = false;
      }
      state.needReadable = !state.flowing && !state.ended && state.length <= state.highWaterMark;
      flow(stream);
    }
    function maybeReadMore(stream, state) {
      if (!state.readingMore && state.constructed) {
        state.readingMore = true;
        process2.nextTick(maybeReadMore_, stream, state);
      }
    }
    function maybeReadMore_(stream, state) {
      while (!state.reading && !state.ended && (state.length < state.highWaterMark || state.flowing && state.length === 0)) {
        const len = state.length;
        debug2("maybeReadMore read 0");
        stream.read(0);
        if (len === state.length)
          break;
      }
      state.readingMore = false;
    }
    Readable.prototype._read = function(n) {
      throw new ERR_METHOD_NOT_IMPLEMENTED("_read()");
    };
    Readable.prototype.pipe = function(dest, pipeOpts) {
      const src = this;
      const state = this._readableState;
      if (state.pipes.length === 1) {
        if (!state.multiAwaitDrain) {
          state.multiAwaitDrain = true;
          state.awaitDrainWriters = new SafeSet(state.awaitDrainWriters ? [state.awaitDrainWriters] : []);
        }
      }
      state.pipes.push(dest);
      debug2("pipe count=%d opts=%j", state.pipes.length, pipeOpts);
      const doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process2.stdout && dest !== process2.stderr;
      const endFn = doEnd ? onend : unpipe;
      if (state.endEmitted) process2.nextTick(endFn);
      else src.once("end", endFn);
      dest.on("unpipe", onunpipe);
      function onunpipe(readable, unpipeInfo) {
        debug2("onunpipe");
        if (readable === src) {
          if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
            unpipeInfo.hasUnpiped = true;
            cleanup();
          }
        }
      }
      function onend() {
        debug2("onend");
        dest.end();
      }
      let ondrain;
      let cleanedUp = false;
      function cleanup() {
        debug2("cleanup");
        dest.removeListener("close", onclose);
        dest.removeListener("finish", onfinish);
        if (ondrain) {
          dest.removeListener("drain", ondrain);
        }
        dest.removeListener("error", onerror);
        dest.removeListener("unpipe", onunpipe);
        src.removeListener("end", onend);
        src.removeListener("end", unpipe);
        src.removeListener("data", ondata);
        cleanedUp = true;
        if (ondrain && state.awaitDrainWriters && (!dest._writableState || dest._writableState.needDrain)) ondrain();
      }
      function pause() {
        if (!cleanedUp) {
          if (state.pipes.length === 1 && state.pipes[0] === dest) {
            debug2("false write response, pause", 0);
            state.awaitDrainWriters = dest;
            state.multiAwaitDrain = false;
          } else if (state.pipes.length > 1 && state.pipes.includes(dest)) {
            debug2("false write response, pause", state.awaitDrainWriters.size);
            state.awaitDrainWriters.add(dest);
          }
          src.pause();
        }
        if (!ondrain) {
          ondrain = pipeOnDrain(src, dest);
          dest.on("drain", ondrain);
        }
      }
      src.on("data", ondata);
      function ondata(chunk) {
        debug2("ondata");
        const ret = dest.write(chunk);
        debug2("dest.write", ret);
        if (ret === false) {
          pause();
        }
      }
      function onerror(er) {
        debug2("onerror", er);
        unpipe();
        dest.removeListener("error", onerror);
        if (dest.listenerCount("error") === 0) {
          const s = dest._writableState || dest._readableState;
          if (s && !s.errorEmitted) {
            errorOrDestroy(dest, er);
          } else {
            dest.emit("error", er);
          }
        }
      }
      prependListener(dest, "error", onerror);
      function onclose() {
        dest.removeListener("finish", onfinish);
        unpipe();
      }
      dest.once("close", onclose);
      function onfinish() {
        debug2("onfinish");
        dest.removeListener("close", onclose);
        unpipe();
      }
      dest.once("finish", onfinish);
      function unpipe() {
        debug2("unpipe");
        src.unpipe(dest);
      }
      dest.emit("pipe", src);
      if (dest.writableNeedDrain === true) {
        pause();
      } else if (!state.flowing) {
        debug2("pipe resume");
        src.resume();
      }
      return dest;
    };
    function pipeOnDrain(src, dest) {
      return function pipeOnDrainFunctionResult() {
        const state = src._readableState;
        if (state.awaitDrainWriters === dest) {
          debug2("pipeOnDrain", 1);
          state.awaitDrainWriters = null;
        } else if (state.multiAwaitDrain) {
          debug2("pipeOnDrain", state.awaitDrainWriters.size);
          state.awaitDrainWriters.delete(dest);
        }
        if ((!state.awaitDrainWriters || state.awaitDrainWriters.size === 0) && src.listenerCount("data")) {
          src.resume();
        }
      };
    }
    Readable.prototype.unpipe = function(dest) {
      const state = this._readableState;
      const unpipeInfo = {
        hasUnpiped: false
      };
      if (state.pipes.length === 0) return this;
      if (!dest) {
        const dests = state.pipes;
        state.pipes = [];
        this.pause();
        for (let i = 0; i < dests.length; i++)
          dests[i].emit("unpipe", this, {
            hasUnpiped: false
          });
        return this;
      }
      const index = ArrayPrototypeIndexOf(state.pipes, dest);
      if (index === -1) return this;
      state.pipes.splice(index, 1);
      if (state.pipes.length === 0) this.pause();
      dest.emit("unpipe", this, unpipeInfo);
      return this;
    };
    Readable.prototype.on = function(ev, fn) {
      const res = Stream.prototype.on.call(this, ev, fn);
      const state = this._readableState;
      if (ev === "data") {
        state.readableListening = this.listenerCount("readable") > 0;
        if (state.flowing !== false) this.resume();
      } else if (ev === "readable") {
        if (!state.endEmitted && !state.readableListening) {
          state.readableListening = state.needReadable = true;
          state.flowing = false;
          state.emittedReadable = false;
          debug2("on readable", state.length, state.reading);
          if (state.length) {
            emitReadable(this);
          } else if (!state.reading) {
            process2.nextTick(nReadingNextTick, this);
          }
        }
      }
      return res;
    };
    Readable.prototype.addListener = Readable.prototype.on;
    Readable.prototype.removeListener = function(ev, fn) {
      const res = Stream.prototype.removeListener.call(this, ev, fn);
      if (ev === "readable") {
        process2.nextTick(updateReadableListening, this);
      }
      return res;
    };
    Readable.prototype.off = Readable.prototype.removeListener;
    Readable.prototype.removeAllListeners = function(ev) {
      const res = Stream.prototype.removeAllListeners.apply(this, arguments);
      if (ev === "readable" || ev === void 0) {
        process2.nextTick(updateReadableListening, this);
      }
      return res;
    };
    function updateReadableListening(self) {
      const state = self._readableState;
      state.readableListening = self.listenerCount("readable") > 0;
      if (state.resumeScheduled && state[kPaused] === false) {
        state.flowing = true;
      } else if (self.listenerCount("data") > 0) {
        self.resume();
      } else if (!state.readableListening) {
        state.flowing = null;
      }
    }
    function nReadingNextTick(self) {
      debug2("readable nexttick read 0");
      self.read(0);
    }
    Readable.prototype.resume = function() {
      const state = this._readableState;
      if (!state.flowing) {
        debug2("resume");
        state.flowing = !state.readableListening;
        resume(this, state);
      }
      state[kPaused] = false;
      return this;
    };
    function resume(stream, state) {
      if (!state.resumeScheduled) {
        state.resumeScheduled = true;
        process2.nextTick(resume_, stream, state);
      }
    }
    function resume_(stream, state) {
      debug2("resume", state.reading);
      if (!state.reading) {
        stream.read(0);
      }
      state.resumeScheduled = false;
      stream.emit("resume");
      flow(stream);
      if (state.flowing && !state.reading) stream.read(0);
    }
    Readable.prototype.pause = function() {
      debug2("call pause flowing=%j", this._readableState.flowing);
      if (this._readableState.flowing !== false) {
        debug2("pause");
        this._readableState.flowing = false;
        this.emit("pause");
      }
      this._readableState[kPaused] = true;
      return this;
    };
    function flow(stream) {
      const state = stream._readableState;
      debug2("flow", state.flowing);
      while (state.flowing && stream.read() !== null) ;
    }
    Readable.prototype.wrap = function(stream) {
      let paused = false;
      stream.on("data", (chunk) => {
        if (!this.push(chunk) && stream.pause) {
          paused = true;
          stream.pause();
        }
      });
      stream.on("end", () => {
        this.push(null);
      });
      stream.on("error", (err2) => {
        errorOrDestroy(this, err2);
      });
      stream.on("close", () => {
        this.destroy();
      });
      stream.on("destroy", () => {
        this.destroy();
      });
      this._read = () => {
        if (paused && stream.resume) {
          paused = false;
          stream.resume();
        }
      };
      const streamKeys = ObjectKeys(stream);
      for (let j = 1; j < streamKeys.length; j++) {
        const i = streamKeys[j];
        if (this[i] === void 0 && typeof stream[i] === "function") {
          this[i] = stream[i].bind(stream);
        }
      }
      return this;
    };
    Readable.prototype[SymbolAsyncIterator] = function() {
      return streamToAsyncIterator(this);
    };
    Readable.prototype.iterator = function(options) {
      if (options !== void 0) {
        validateObject(options, "options");
      }
      return streamToAsyncIterator(this, options);
    };
    function streamToAsyncIterator(stream, options) {
      if (typeof stream.read !== "function") {
        stream = Readable.wrap(stream, {
          objectMode: true
        });
      }
      const iter = createAsyncIterator(stream, options);
      iter.stream = stream;
      return iter;
    }
    async function* createAsyncIterator(stream, options) {
      let callback = nop;
      function next(resolve3) {
        if (this === stream) {
          callback();
          callback = nop;
        } else {
          callback = resolve3;
        }
      }
      stream.on("readable", next);
      let error2;
      const cleanup = eos(
        stream,
        {
          writable: false
        },
        (err2) => {
          error2 = err2 ? aggregateTwoErrors(error2, err2) : null;
          callback();
          callback = nop;
        }
      );
      try {
        while (true) {
          const chunk = stream.destroyed ? null : stream.read();
          if (chunk !== null) {
            yield chunk;
          } else if (error2) {
            throw error2;
          } else if (error2 === null) {
            return;
          } else {
            await new Promise2(next);
          }
        }
      } catch (err2) {
        error2 = aggregateTwoErrors(error2, err2);
        throw error2;
      } finally {
        if ((error2 || (options === null || options === void 0 ? void 0 : options.destroyOnReturn) !== false) && (error2 === void 0 || stream._readableState.autoDestroy)) {
          destroyImpl.destroyer(stream, null);
        } else {
          stream.off("readable", next);
          cleanup();
        }
      }
    }
    ObjectDefineProperties(Readable.prototype, {
      readable: {
        __proto__: null,
        get() {
          const r = this._readableState;
          return !!r && r.readable !== false && !r.destroyed && !r.errorEmitted && !r.endEmitted;
        },
        set(val) {
          if (this._readableState) {
            this._readableState.readable = !!val;
          }
        }
      },
      readableDidRead: {
        __proto__: null,
        enumerable: false,
        get: function() {
          return this._readableState.dataEmitted;
        }
      },
      readableAborted: {
        __proto__: null,
        enumerable: false,
        get: function() {
          return !!(this._readableState.readable !== false && (this._readableState.destroyed || this._readableState.errored) && !this._readableState.endEmitted);
        }
      },
      readableHighWaterMark: {
        __proto__: null,
        enumerable: false,
        get: function() {
          return this._readableState.highWaterMark;
        }
      },
      readableBuffer: {
        __proto__: null,
        enumerable: false,
        get: function() {
          return this._readableState && this._readableState.buffer;
        }
      },
      readableFlowing: {
        __proto__: null,
        enumerable: false,
        get: function() {
          return this._readableState.flowing;
        },
        set: function(state) {
          if (this._readableState) {
            this._readableState.flowing = state;
          }
        }
      },
      readableLength: {
        __proto__: null,
        enumerable: false,
        get() {
          return this._readableState.length;
        }
      },
      readableObjectMode: {
        __proto__: null,
        enumerable: false,
        get() {
          return this._readableState ? this._readableState.objectMode : false;
        }
      },
      readableEncoding: {
        __proto__: null,
        enumerable: false,
        get() {
          return this._readableState ? this._readableState.encoding : null;
        }
      },
      errored: {
        __proto__: null,
        enumerable: false,
        get() {
          return this._readableState ? this._readableState.errored : null;
        }
      },
      closed: {
        __proto__: null,
        get() {
          return this._readableState ? this._readableState.closed : false;
        }
      },
      destroyed: {
        __proto__: null,
        enumerable: false,
        get() {
          return this._readableState ? this._readableState.destroyed : false;
        },
        set(value) {
          if (!this._readableState) {
            return;
          }
          this._readableState.destroyed = value;
        }
      },
      readableEnded: {
        __proto__: null,
        enumerable: false,
        get() {
          return this._readableState ? this._readableState.endEmitted : false;
        }
      }
    });
    ObjectDefineProperties(ReadableState.prototype, {
      // Legacy getter for `pipesCount`.
      pipesCount: {
        __proto__: null,
        get() {
          return this.pipes.length;
        }
      },
      // Legacy property for `paused`.
      paused: {
        __proto__: null,
        get() {
          return this[kPaused] !== false;
        },
        set(value) {
          this[kPaused] = !!value;
        }
      }
    });
    Readable._fromList = fromList;
    function fromList(n, state) {
      if (state.length === 0) return null;
      let ret;
      if (state.objectMode) ret = state.buffer.shift();
      else if (!n || n >= state.length) {
        if (state.decoder) ret = state.buffer.join("");
        else if (state.buffer.length === 1) ret = state.buffer.first();
        else ret = state.buffer.concat(state.length);
        state.buffer.clear();
      } else {
        ret = state.buffer.consume(n, state.decoder);
      }
      return ret;
    }
    function endReadable(stream) {
      const state = stream._readableState;
      debug2("endReadable", state.endEmitted);
      if (!state.endEmitted) {
        state.ended = true;
        process2.nextTick(endReadableNT, state, stream);
      }
    }
    function endReadableNT(state, stream) {
      debug2("endReadableNT", state.endEmitted, state.length);
      if (!state.errored && !state.closeEmitted && !state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.emit("end");
        if (stream.writable && stream.allowHalfOpen === false) {
          process2.nextTick(endWritableNT, stream);
        } else if (state.autoDestroy) {
          const wState = stream._writableState;
          const autoDestroy = !wState || wState.autoDestroy && // We don't expect the writable to ever 'finish'
          // if writable is explicitly set to false.
          (wState.finished || wState.writable === false);
          if (autoDestroy) {
            stream.destroy();
          }
        }
      }
    }
    function endWritableNT(stream) {
      const writable = stream.writable && !stream.writableEnded && !stream.destroyed;
      if (writable) {
        stream.end();
      }
    }
    Readable.from = function(iterable, opts) {
      return from(Readable, iterable, opts);
    };
    var webStreamsAdapters;
    function lazyWebStreams() {
      if (webStreamsAdapters === void 0) webStreamsAdapters = {};
      return webStreamsAdapters;
    }
    Readable.fromWeb = function(readableStream, options) {
      return lazyWebStreams().newStreamReadableFromReadableStream(readableStream, options);
    };
    Readable.toWeb = function(streamReadable, options) {
      return lazyWebStreams().newReadableStreamFromStreamReadable(streamReadable, options);
    };
    Readable.wrap = function(src, options) {
      var _ref, _src$readableObjectMo;
      return new Readable({
        objectMode: (_ref = (_src$readableObjectMo = src.readableObjectMode) !== null && _src$readableObjectMo !== void 0 ? _src$readableObjectMo : src.objectMode) !== null && _ref !== void 0 ? _ref : true,
        ...options,
        destroy(err2, callback) {
          destroyImpl.destroyer(src, err2);
          callback(err2);
        }
      }).wrap(src);
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/writable.js
var require_writable = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/writable.js"(exports, module) {
    "use strict";
    var process2 = require_process();
    var {
      ArrayPrototypeSlice,
      Error: Error2,
      FunctionPrototypeSymbolHasInstance,
      ObjectDefineProperty,
      ObjectDefineProperties,
      ObjectSetPrototypeOf,
      StringPrototypeToLowerCase,
      Symbol: Symbol2,
      SymbolHasInstance
    } = require_primordials();
    module.exports = Writable;
    Writable.WritableState = WritableState;
    var { EventEmitter: EE } = __require("events");
    var Stream = require_legacy().Stream;
    var { Buffer: Buffer2 } = __require("buffer");
    var destroyImpl = require_destroy();
    var { addAbortSignal } = require_add_abort_signal();
    var { getHighWaterMark, getDefaultHighWaterMark } = require_state();
    var {
      ERR_INVALID_ARG_TYPE,
      ERR_METHOD_NOT_IMPLEMENTED,
      ERR_MULTIPLE_CALLBACK,
      ERR_STREAM_CANNOT_PIPE,
      ERR_STREAM_DESTROYED,
      ERR_STREAM_ALREADY_FINISHED,
      ERR_STREAM_NULL_VALUES,
      ERR_STREAM_WRITE_AFTER_END,
      ERR_UNKNOWN_ENCODING
    } = require_errors().codes;
    var { errorOrDestroy } = destroyImpl;
    ObjectSetPrototypeOf(Writable.prototype, Stream.prototype);
    ObjectSetPrototypeOf(Writable, Stream);
    function nop() {
    }
    var kOnFinished = Symbol2("kOnFinished");
    function WritableState(options, stream, isDuplex) {
      if (typeof isDuplex !== "boolean") isDuplex = stream instanceof require_duplex();
      this.objectMode = !!(options && options.objectMode);
      if (isDuplex) this.objectMode = this.objectMode || !!(options && options.writableObjectMode);
      this.highWaterMark = options ? getHighWaterMark(this, options, "writableHighWaterMark", isDuplex) : getDefaultHighWaterMark(false);
      this.finalCalled = false;
      this.needDrain = false;
      this.ending = false;
      this.ended = false;
      this.finished = false;
      this.destroyed = false;
      const noDecode = !!(options && options.decodeStrings === false);
      this.decodeStrings = !noDecode;
      this.defaultEncoding = options && options.defaultEncoding || "utf8";
      this.length = 0;
      this.writing = false;
      this.corked = 0;
      this.sync = true;
      this.bufferProcessing = false;
      this.onwrite = onwrite.bind(void 0, stream);
      this.writecb = null;
      this.writelen = 0;
      this.afterWriteTickInfo = null;
      resetBuffer(this);
      this.pendingcb = 0;
      this.constructed = true;
      this.prefinished = false;
      this.errorEmitted = false;
      this.emitClose = !options || options.emitClose !== false;
      this.autoDestroy = !options || options.autoDestroy !== false;
      this.errored = null;
      this.closed = false;
      this.closeEmitted = false;
      this[kOnFinished] = [];
    }
    function resetBuffer(state) {
      state.buffered = [];
      state.bufferedIndex = 0;
      state.allBuffers = true;
      state.allNoop = true;
    }
    WritableState.prototype.getBuffer = function getBuffer() {
      return ArrayPrototypeSlice(this.buffered, this.bufferedIndex);
    };
    ObjectDefineProperty(WritableState.prototype, "bufferedRequestCount", {
      __proto__: null,
      get() {
        return this.buffered.length - this.bufferedIndex;
      }
    });
    function Writable(options) {
      const isDuplex = this instanceof require_duplex();
      if (!isDuplex && !FunctionPrototypeSymbolHasInstance(Writable, this)) return new Writable(options);
      this._writableState = new WritableState(options, this, isDuplex);
      if (options) {
        if (typeof options.write === "function") this._write = options.write;
        if (typeof options.writev === "function") this._writev = options.writev;
        if (typeof options.destroy === "function") this._destroy = options.destroy;
        if (typeof options.final === "function") this._final = options.final;
        if (typeof options.construct === "function") this._construct = options.construct;
        if (options.signal) addAbortSignal(options.signal, this);
      }
      Stream.call(this, options);
      destroyImpl.construct(this, () => {
        const state = this._writableState;
        if (!state.writing) {
          clearBuffer(this, state);
        }
        finishMaybe(this, state);
      });
    }
    ObjectDefineProperty(Writable, SymbolHasInstance, {
      __proto__: null,
      value: function(object) {
        if (FunctionPrototypeSymbolHasInstance(this, object)) return true;
        if (this !== Writable) return false;
        return object && object._writableState instanceof WritableState;
      }
    });
    Writable.prototype.pipe = function() {
      errorOrDestroy(this, new ERR_STREAM_CANNOT_PIPE());
    };
    function _write(stream, chunk, encoding, cb) {
      const state = stream._writableState;
      if (typeof encoding === "function") {
        cb = encoding;
        encoding = state.defaultEncoding;
      } else {
        if (!encoding) encoding = state.defaultEncoding;
        else if (encoding !== "buffer" && !Buffer2.isEncoding(encoding)) throw new ERR_UNKNOWN_ENCODING(encoding);
        if (typeof cb !== "function") cb = nop;
      }
      if (chunk === null) {
        throw new ERR_STREAM_NULL_VALUES();
      } else if (!state.objectMode) {
        if (typeof chunk === "string") {
          if (state.decodeStrings !== false) {
            chunk = Buffer2.from(chunk, encoding);
            encoding = "buffer";
          }
        } else if (chunk instanceof Buffer2) {
          encoding = "buffer";
        } else if (Stream._isUint8Array(chunk)) {
          chunk = Stream._uint8ArrayToBuffer(chunk);
          encoding = "buffer";
        } else {
          throw new ERR_INVALID_ARG_TYPE("chunk", ["string", "Buffer", "Uint8Array"], chunk);
        }
      }
      let err2;
      if (state.ending) {
        err2 = new ERR_STREAM_WRITE_AFTER_END();
      } else if (state.destroyed) {
        err2 = new ERR_STREAM_DESTROYED("write");
      }
      if (err2) {
        process2.nextTick(cb, err2);
        errorOrDestroy(stream, err2, true);
        return err2;
      }
      state.pendingcb++;
      return writeOrBuffer(stream, state, chunk, encoding, cb);
    }
    Writable.prototype.write = function(chunk, encoding, cb) {
      return _write(this, chunk, encoding, cb) === true;
    };
    Writable.prototype.cork = function() {
      this._writableState.corked++;
    };
    Writable.prototype.uncork = function() {
      const state = this._writableState;
      if (state.corked) {
        state.corked--;
        if (!state.writing) clearBuffer(this, state);
      }
    };
    Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
      if (typeof encoding === "string") encoding = StringPrototypeToLowerCase(encoding);
      if (!Buffer2.isEncoding(encoding)) throw new ERR_UNKNOWN_ENCODING(encoding);
      this._writableState.defaultEncoding = encoding;
      return this;
    };
    function writeOrBuffer(stream, state, chunk, encoding, callback) {
      const len = state.objectMode ? 1 : chunk.length;
      state.length += len;
      const ret = state.length < state.highWaterMark;
      if (!ret) state.needDrain = true;
      if (state.writing || state.corked || state.errored || !state.constructed) {
        state.buffered.push({
          chunk,
          encoding,
          callback
        });
        if (state.allBuffers && encoding !== "buffer") {
          state.allBuffers = false;
        }
        if (state.allNoop && callback !== nop) {
          state.allNoop = false;
        }
      } else {
        state.writelen = len;
        state.writecb = callback;
        state.writing = true;
        state.sync = true;
        stream._write(chunk, encoding, state.onwrite);
        state.sync = false;
      }
      return ret && !state.errored && !state.destroyed;
    }
    function doWrite(stream, state, writev, len, chunk, encoding, cb) {
      state.writelen = len;
      state.writecb = cb;
      state.writing = true;
      state.sync = true;
      if (state.destroyed) state.onwrite(new ERR_STREAM_DESTROYED("write"));
      else if (writev) stream._writev(chunk, state.onwrite);
      else stream._write(chunk, encoding, state.onwrite);
      state.sync = false;
    }
    function onwriteError(stream, state, er, cb) {
      --state.pendingcb;
      cb(er);
      errorBuffer(state);
      errorOrDestroy(stream, er);
    }
    function onwrite(stream, er) {
      const state = stream._writableState;
      const sync = state.sync;
      const cb = state.writecb;
      if (typeof cb !== "function") {
        errorOrDestroy(stream, new ERR_MULTIPLE_CALLBACK());
        return;
      }
      state.writing = false;
      state.writecb = null;
      state.length -= state.writelen;
      state.writelen = 0;
      if (er) {
        er.stack;
        if (!state.errored) {
          state.errored = er;
        }
        if (stream._readableState && !stream._readableState.errored) {
          stream._readableState.errored = er;
        }
        if (sync) {
          process2.nextTick(onwriteError, stream, state, er, cb);
        } else {
          onwriteError(stream, state, er, cb);
        }
      } else {
        if (state.buffered.length > state.bufferedIndex) {
          clearBuffer(stream, state);
        }
        if (sync) {
          if (state.afterWriteTickInfo !== null && state.afterWriteTickInfo.cb === cb) {
            state.afterWriteTickInfo.count++;
          } else {
            state.afterWriteTickInfo = {
              count: 1,
              cb,
              stream,
              state
            };
            process2.nextTick(afterWriteTick, state.afterWriteTickInfo);
          }
        } else {
          afterWrite(stream, state, 1, cb);
        }
      }
    }
    function afterWriteTick({ stream, state, count, cb }) {
      state.afterWriteTickInfo = null;
      return afterWrite(stream, state, count, cb);
    }
    function afterWrite(stream, state, count, cb) {
      const needDrain = !state.ending && !stream.destroyed && state.length === 0 && state.needDrain;
      if (needDrain) {
        state.needDrain = false;
        stream.emit("drain");
      }
      while (count-- > 0) {
        state.pendingcb--;
        cb();
      }
      if (state.destroyed) {
        errorBuffer(state);
      }
      finishMaybe(stream, state);
    }
    function errorBuffer(state) {
      if (state.writing) {
        return;
      }
      for (let n = state.bufferedIndex; n < state.buffered.length; ++n) {
        var _state$errored;
        const { chunk, callback } = state.buffered[n];
        const len = state.objectMode ? 1 : chunk.length;
        state.length -= len;
        callback(
          (_state$errored = state.errored) !== null && _state$errored !== void 0 ? _state$errored : new ERR_STREAM_DESTROYED("write")
        );
      }
      const onfinishCallbacks = state[kOnFinished].splice(0);
      for (let i = 0; i < onfinishCallbacks.length; i++) {
        var _state$errored2;
        onfinishCallbacks[i](
          (_state$errored2 = state.errored) !== null && _state$errored2 !== void 0 ? _state$errored2 : new ERR_STREAM_DESTROYED("end")
        );
      }
      resetBuffer(state);
    }
    function clearBuffer(stream, state) {
      if (state.corked || state.bufferProcessing || state.destroyed || !state.constructed) {
        return;
      }
      const { buffered, bufferedIndex, objectMode } = state;
      const bufferedLength = buffered.length - bufferedIndex;
      if (!bufferedLength) {
        return;
      }
      let i = bufferedIndex;
      state.bufferProcessing = true;
      if (bufferedLength > 1 && stream._writev) {
        state.pendingcb -= bufferedLength - 1;
        const callback = state.allNoop ? nop : (err2) => {
          for (let n = i; n < buffered.length; ++n) {
            buffered[n].callback(err2);
          }
        };
        const chunks = state.allNoop && i === 0 ? buffered : ArrayPrototypeSlice(buffered, i);
        chunks.allBuffers = state.allBuffers;
        doWrite(stream, state, true, state.length, chunks, "", callback);
        resetBuffer(state);
      } else {
        do {
          const { chunk, encoding, callback } = buffered[i];
          buffered[i++] = null;
          const len = objectMode ? 1 : chunk.length;
          doWrite(stream, state, false, len, chunk, encoding, callback);
        } while (i < buffered.length && !state.writing);
        if (i === buffered.length) {
          resetBuffer(state);
        } else if (i > 256) {
          buffered.splice(0, i);
          state.bufferedIndex = 0;
        } else {
          state.bufferedIndex = i;
        }
      }
      state.bufferProcessing = false;
    }
    Writable.prototype._write = function(chunk, encoding, cb) {
      if (this._writev) {
        this._writev(
          [
            {
              chunk,
              encoding
            }
          ],
          cb
        );
      } else {
        throw new ERR_METHOD_NOT_IMPLEMENTED("_write()");
      }
    };
    Writable.prototype._writev = null;
    Writable.prototype.end = function(chunk, encoding, cb) {
      const state = this._writableState;
      if (typeof chunk === "function") {
        cb = chunk;
        chunk = null;
        encoding = null;
      } else if (typeof encoding === "function") {
        cb = encoding;
        encoding = null;
      }
      let err2;
      if (chunk !== null && chunk !== void 0) {
        const ret = _write(this, chunk, encoding);
        if (ret instanceof Error2) {
          err2 = ret;
        }
      }
      if (state.corked) {
        state.corked = 1;
        this.uncork();
      }
      if (err2) {
      } else if (!state.errored && !state.ending) {
        state.ending = true;
        finishMaybe(this, state, true);
        state.ended = true;
      } else if (state.finished) {
        err2 = new ERR_STREAM_ALREADY_FINISHED("end");
      } else if (state.destroyed) {
        err2 = new ERR_STREAM_DESTROYED("end");
      }
      if (typeof cb === "function") {
        if (err2 || state.finished) {
          process2.nextTick(cb, err2);
        } else {
          state[kOnFinished].push(cb);
        }
      }
      return this;
    };
    function needFinish(state) {
      return state.ending && !state.destroyed && state.constructed && state.length === 0 && !state.errored && state.buffered.length === 0 && !state.finished && !state.writing && !state.errorEmitted && !state.closeEmitted;
    }
    function callFinal(stream, state) {
      let called = false;
      function onFinish(err2) {
        if (called) {
          errorOrDestroy(stream, err2 !== null && err2 !== void 0 ? err2 : ERR_MULTIPLE_CALLBACK());
          return;
        }
        called = true;
        state.pendingcb--;
        if (err2) {
          const onfinishCallbacks = state[kOnFinished].splice(0);
          for (let i = 0; i < onfinishCallbacks.length; i++) {
            onfinishCallbacks[i](err2);
          }
          errorOrDestroy(stream, err2, state.sync);
        } else if (needFinish(state)) {
          state.prefinished = true;
          stream.emit("prefinish");
          state.pendingcb++;
          process2.nextTick(finish, stream, state);
        }
      }
      state.sync = true;
      state.pendingcb++;
      try {
        stream._final(onFinish);
      } catch (err2) {
        onFinish(err2);
      }
      state.sync = false;
    }
    function prefinish(stream, state) {
      if (!state.prefinished && !state.finalCalled) {
        if (typeof stream._final === "function" && !state.destroyed) {
          state.finalCalled = true;
          callFinal(stream, state);
        } else {
          state.prefinished = true;
          stream.emit("prefinish");
        }
      }
    }
    function finishMaybe(stream, state, sync) {
      if (needFinish(state)) {
        prefinish(stream, state);
        if (state.pendingcb === 0) {
          if (sync) {
            state.pendingcb++;
            process2.nextTick(
              (stream2, state2) => {
                if (needFinish(state2)) {
                  finish(stream2, state2);
                } else {
                  state2.pendingcb--;
                }
              },
              stream,
              state
            );
          } else if (needFinish(state)) {
            state.pendingcb++;
            finish(stream, state);
          }
        }
      }
    }
    function finish(stream, state) {
      state.pendingcb--;
      state.finished = true;
      const onfinishCallbacks = state[kOnFinished].splice(0);
      for (let i = 0; i < onfinishCallbacks.length; i++) {
        onfinishCallbacks[i]();
      }
      stream.emit("finish");
      if (state.autoDestroy) {
        const rState = stream._readableState;
        const autoDestroy = !rState || rState.autoDestroy && // We don't expect the readable to ever 'end'
        // if readable is explicitly set to false.
        (rState.endEmitted || rState.readable === false);
        if (autoDestroy) {
          stream.destroy();
        }
      }
    }
    ObjectDefineProperties(Writable.prototype, {
      closed: {
        __proto__: null,
        get() {
          return this._writableState ? this._writableState.closed : false;
        }
      },
      destroyed: {
        __proto__: null,
        get() {
          return this._writableState ? this._writableState.destroyed : false;
        },
        set(value) {
          if (this._writableState) {
            this._writableState.destroyed = value;
          }
        }
      },
      writable: {
        __proto__: null,
        get() {
          const w = this._writableState;
          return !!w && w.writable !== false && !w.destroyed && !w.errored && !w.ending && !w.ended;
        },
        set(val) {
          if (this._writableState) {
            this._writableState.writable = !!val;
          }
        }
      },
      writableFinished: {
        __proto__: null,
        get() {
          return this._writableState ? this._writableState.finished : false;
        }
      },
      writableObjectMode: {
        __proto__: null,
        get() {
          return this._writableState ? this._writableState.objectMode : false;
        }
      },
      writableBuffer: {
        __proto__: null,
        get() {
          return this._writableState && this._writableState.getBuffer();
        }
      },
      writableEnded: {
        __proto__: null,
        get() {
          return this._writableState ? this._writableState.ending : false;
        }
      },
      writableNeedDrain: {
        __proto__: null,
        get() {
          const wState = this._writableState;
          if (!wState) return false;
          return !wState.destroyed && !wState.ending && wState.needDrain;
        }
      },
      writableHighWaterMark: {
        __proto__: null,
        get() {
          return this._writableState && this._writableState.highWaterMark;
        }
      },
      writableCorked: {
        __proto__: null,
        get() {
          return this._writableState ? this._writableState.corked : 0;
        }
      },
      writableLength: {
        __proto__: null,
        get() {
          return this._writableState && this._writableState.length;
        }
      },
      errored: {
        __proto__: null,
        enumerable: false,
        get() {
          return this._writableState ? this._writableState.errored : null;
        }
      },
      writableAborted: {
        __proto__: null,
        enumerable: false,
        get: function() {
          return !!(this._writableState.writable !== false && (this._writableState.destroyed || this._writableState.errored) && !this._writableState.finished);
        }
      }
    });
    var destroy = destroyImpl.destroy;
    Writable.prototype.destroy = function(err2, cb) {
      const state = this._writableState;
      if (!state.destroyed && (state.bufferedIndex < state.buffered.length || state[kOnFinished].length)) {
        process2.nextTick(errorBuffer, state);
      }
      destroy.call(this, err2, cb);
      return this;
    };
    Writable.prototype._undestroy = destroyImpl.undestroy;
    Writable.prototype._destroy = function(err2, cb) {
      cb(err2);
    };
    Writable.prototype[EE.captureRejectionSymbol] = function(err2) {
      this.destroy(err2);
    };
    var webStreamsAdapters;
    function lazyWebStreams() {
      if (webStreamsAdapters === void 0) webStreamsAdapters = {};
      return webStreamsAdapters;
    }
    Writable.fromWeb = function(writableStream, options) {
      return lazyWebStreams().newStreamWritableFromWritableStream(writableStream, options);
    };
    Writable.toWeb = function(streamWritable) {
      return lazyWebStreams().newWritableStreamFromStreamWritable(streamWritable);
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/duplexify.js
var require_duplexify = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/duplexify.js"(exports, module) {
    var process2 = require_process();
    var bufferModule = __require("buffer");
    var {
      isReadable,
      isWritable,
      isIterable,
      isNodeStream,
      isReadableNodeStream,
      isWritableNodeStream,
      isDuplexNodeStream,
      isReadableStream,
      isWritableStream
    } = require_utils();
    var eos = require_end_of_stream();
    var {
      AbortError,
      codes: { ERR_INVALID_ARG_TYPE, ERR_INVALID_RETURN_VALUE }
    } = require_errors();
    var { destroyer } = require_destroy();
    var Duplex = require_duplex();
    var Readable = require_readable();
    var Writable = require_writable();
    var { createDeferredPromise } = require_util();
    var from = require_from();
    var Blob = globalThis.Blob || bufferModule.Blob;
    var isBlob = typeof Blob !== "undefined" ? function isBlob2(b) {
      return b instanceof Blob;
    } : function isBlob2(b) {
      return false;
    };
    var AbortController = globalThis.AbortController || require_abort_controller().AbortController;
    var { FunctionPrototypeCall } = require_primordials();
    var Duplexify = class extends Duplex {
      constructor(options) {
        super(options);
        if ((options === null || options === void 0 ? void 0 : options.readable) === false) {
          this._readableState.readable = false;
          this._readableState.ended = true;
          this._readableState.endEmitted = true;
        }
        if ((options === null || options === void 0 ? void 0 : options.writable) === false) {
          this._writableState.writable = false;
          this._writableState.ending = true;
          this._writableState.ended = true;
          this._writableState.finished = true;
        }
      }
    };
    module.exports = function duplexify(body, name) {
      if (isDuplexNodeStream(body)) {
        return body;
      }
      if (isReadableNodeStream(body)) {
        return _duplexify({
          readable: body
        });
      }
      if (isWritableNodeStream(body)) {
        return _duplexify({
          writable: body
        });
      }
      if (isNodeStream(body)) {
        return _duplexify({
          writable: false,
          readable: false
        });
      }
      if (isReadableStream(body)) {
        return _duplexify({
          readable: Readable.fromWeb(body)
        });
      }
      if (isWritableStream(body)) {
        return _duplexify({
          writable: Writable.fromWeb(body)
        });
      }
      if (typeof body === "function") {
        const { value, write, final, destroy } = fromAsyncGen(body);
        if (isIterable(value)) {
          return from(Duplexify, value, {
            // TODO (ronag): highWaterMark?
            objectMode: true,
            write,
            final,
            destroy
          });
        }
        const then2 = value === null || value === void 0 ? void 0 : value.then;
        if (typeof then2 === "function") {
          let d;
          const promise = FunctionPrototypeCall(
            then2,
            value,
            (val) => {
              if (val != null) {
                throw new ERR_INVALID_RETURN_VALUE("nully", "body", val);
              }
            },
            (err2) => {
              destroyer(d, err2);
            }
          );
          return d = new Duplexify({
            // TODO (ronag): highWaterMark?
            objectMode: true,
            readable: false,
            write,
            final(cb) {
              final(async () => {
                try {
                  await promise;
                  process2.nextTick(cb, null);
                } catch (err2) {
                  process2.nextTick(cb, err2);
                }
              });
            },
            destroy
          });
        }
        throw new ERR_INVALID_RETURN_VALUE("Iterable, AsyncIterable or AsyncFunction", name, value);
      }
      if (isBlob(body)) {
        return duplexify(body.arrayBuffer());
      }
      if (isIterable(body)) {
        return from(Duplexify, body, {
          // TODO (ronag): highWaterMark?
          objectMode: true,
          writable: false
        });
      }
      if (isReadableStream(body === null || body === void 0 ? void 0 : body.readable) && isWritableStream(body === null || body === void 0 ? void 0 : body.writable)) {
        return Duplexify.fromWeb(body);
      }
      if (typeof (body === null || body === void 0 ? void 0 : body.writable) === "object" || typeof (body === null || body === void 0 ? void 0 : body.readable) === "object") {
        const readable = body !== null && body !== void 0 && body.readable ? isReadableNodeStream(body === null || body === void 0 ? void 0 : body.readable) ? body === null || body === void 0 ? void 0 : body.readable : duplexify(body.readable) : void 0;
        const writable = body !== null && body !== void 0 && body.writable ? isWritableNodeStream(body === null || body === void 0 ? void 0 : body.writable) ? body === null || body === void 0 ? void 0 : body.writable : duplexify(body.writable) : void 0;
        return _duplexify({
          readable,
          writable
        });
      }
      const then = body === null || body === void 0 ? void 0 : body.then;
      if (typeof then === "function") {
        let d;
        FunctionPrototypeCall(
          then,
          body,
          (val) => {
            if (val != null) {
              d.push(val);
            }
            d.push(null);
          },
          (err2) => {
            destroyer(d, err2);
          }
        );
        return d = new Duplexify({
          objectMode: true,
          writable: false,
          read() {
          }
        });
      }
      throw new ERR_INVALID_ARG_TYPE(
        name,
        [
          "Blob",
          "ReadableStream",
          "WritableStream",
          "Stream",
          "Iterable",
          "AsyncIterable",
          "Function",
          "{ readable, writable } pair",
          "Promise"
        ],
        body
      );
    };
    function fromAsyncGen(fn) {
      let { promise, resolve: resolve3 } = createDeferredPromise();
      const ac = new AbortController();
      const signal = ac.signal;
      const value = fn(
        (async function* () {
          while (true) {
            const _promise = promise;
            promise = null;
            const { chunk, done, cb } = await _promise;
            process2.nextTick(cb);
            if (done) return;
            if (signal.aborted)
              throw new AbortError(void 0, {
                cause: signal.reason
              });
            ({ promise, resolve: resolve3 } = createDeferredPromise());
            yield chunk;
          }
        })(),
        {
          signal
        }
      );
      return {
        value,
        write(chunk, encoding, cb) {
          const _resolve = resolve3;
          resolve3 = null;
          _resolve({
            chunk,
            done: false,
            cb
          });
        },
        final(cb) {
          const _resolve = resolve3;
          resolve3 = null;
          _resolve({
            done: true,
            cb
          });
        },
        destroy(err2, cb) {
          ac.abort();
          cb(err2);
        }
      };
    }
    function _duplexify(pair) {
      const r = pair.readable && typeof pair.readable.read !== "function" ? Readable.wrap(pair.readable) : pair.readable;
      const w = pair.writable;
      let readable = !!isReadable(r);
      let writable = !!isWritable(w);
      let ondrain;
      let onfinish;
      let onreadable;
      let onclose;
      let d;
      function onfinished(err2) {
        const cb = onclose;
        onclose = null;
        if (cb) {
          cb(err2);
        } else if (err2) {
          d.destroy(err2);
        }
      }
      d = new Duplexify({
        // TODO (ronag): highWaterMark?
        readableObjectMode: !!(r !== null && r !== void 0 && r.readableObjectMode),
        writableObjectMode: !!(w !== null && w !== void 0 && w.writableObjectMode),
        readable,
        writable
      });
      if (writable) {
        eos(w, (err2) => {
          writable = false;
          if (err2) {
            destroyer(r, err2);
          }
          onfinished(err2);
        });
        d._write = function(chunk, encoding, callback) {
          if (w.write(chunk, encoding)) {
            callback();
          } else {
            ondrain = callback;
          }
        };
        d._final = function(callback) {
          w.end();
          onfinish = callback;
        };
        w.on("drain", function() {
          if (ondrain) {
            const cb = ondrain;
            ondrain = null;
            cb();
          }
        });
        w.on("finish", function() {
          if (onfinish) {
            const cb = onfinish;
            onfinish = null;
            cb();
          }
        });
      }
      if (readable) {
        eos(r, (err2) => {
          readable = false;
          if (err2) {
            destroyer(r, err2);
          }
          onfinished(err2);
        });
        r.on("readable", function() {
          if (onreadable) {
            const cb = onreadable;
            onreadable = null;
            cb();
          }
        });
        r.on("end", function() {
          d.push(null);
        });
        d._read = function() {
          while (true) {
            const buf = r.read();
            if (buf === null) {
              onreadable = d._read;
              return;
            }
            if (!d.push(buf)) {
              return;
            }
          }
        };
      }
      d._destroy = function(err2, callback) {
        if (!err2 && onclose !== null) {
          err2 = new AbortError();
        }
        onreadable = null;
        ondrain = null;
        onfinish = null;
        if (onclose === null) {
          callback(err2);
        } else {
          onclose = callback;
          destroyer(w, err2);
          destroyer(r, err2);
        }
      };
      return d;
    }
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/duplex.js
var require_duplex = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/duplex.js"(exports, module) {
    "use strict";
    var {
      ObjectDefineProperties,
      ObjectGetOwnPropertyDescriptor,
      ObjectKeys,
      ObjectSetPrototypeOf
    } = require_primordials();
    module.exports = Duplex;
    var Readable = require_readable();
    var Writable = require_writable();
    ObjectSetPrototypeOf(Duplex.prototype, Readable.prototype);
    ObjectSetPrototypeOf(Duplex, Readable);
    {
      const keys = ObjectKeys(Writable.prototype);
      for (let i = 0; i < keys.length; i++) {
        const method = keys[i];
        if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
      }
    }
    function Duplex(options) {
      if (!(this instanceof Duplex)) return new Duplex(options);
      Readable.call(this, options);
      Writable.call(this, options);
      if (options) {
        this.allowHalfOpen = options.allowHalfOpen !== false;
        if (options.readable === false) {
          this._readableState.readable = false;
          this._readableState.ended = true;
          this._readableState.endEmitted = true;
        }
        if (options.writable === false) {
          this._writableState.writable = false;
          this._writableState.ending = true;
          this._writableState.ended = true;
          this._writableState.finished = true;
        }
      } else {
        this.allowHalfOpen = true;
      }
    }
    ObjectDefineProperties(Duplex.prototype, {
      writable: {
        __proto__: null,
        ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writable")
      },
      writableHighWaterMark: {
        __proto__: null,
        ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableHighWaterMark")
      },
      writableObjectMode: {
        __proto__: null,
        ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableObjectMode")
      },
      writableBuffer: {
        __proto__: null,
        ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableBuffer")
      },
      writableLength: {
        __proto__: null,
        ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableLength")
      },
      writableFinished: {
        __proto__: null,
        ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableFinished")
      },
      writableCorked: {
        __proto__: null,
        ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableCorked")
      },
      writableEnded: {
        __proto__: null,
        ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableEnded")
      },
      writableNeedDrain: {
        __proto__: null,
        ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableNeedDrain")
      },
      destroyed: {
        __proto__: null,
        get() {
          if (this._readableState === void 0 || this._writableState === void 0) {
            return false;
          }
          return this._readableState.destroyed && this._writableState.destroyed;
        },
        set(value) {
          if (this._readableState && this._writableState) {
            this._readableState.destroyed = value;
            this._writableState.destroyed = value;
          }
        }
      }
    });
    var webStreamsAdapters;
    function lazyWebStreams() {
      if (webStreamsAdapters === void 0) webStreamsAdapters = {};
      return webStreamsAdapters;
    }
    Duplex.fromWeb = function(pair, options) {
      return lazyWebStreams().newStreamDuplexFromReadableWritablePair(pair, options);
    };
    Duplex.toWeb = function(duplex) {
      return lazyWebStreams().newReadableWritablePairFromDuplex(duplex);
    };
    var duplexify;
    Duplex.from = function(body) {
      if (!duplexify) {
        duplexify = require_duplexify();
      }
      return duplexify(body, "body");
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/transform.js
var require_transform = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/transform.js"(exports, module) {
    "use strict";
    var { ObjectSetPrototypeOf, Symbol: Symbol2 } = require_primordials();
    module.exports = Transform;
    var { ERR_METHOD_NOT_IMPLEMENTED } = require_errors().codes;
    var Duplex = require_duplex();
    var { getHighWaterMark } = require_state();
    ObjectSetPrototypeOf(Transform.prototype, Duplex.prototype);
    ObjectSetPrototypeOf(Transform, Duplex);
    var kCallback = Symbol2("kCallback");
    function Transform(options) {
      if (!(this instanceof Transform)) return new Transform(options);
      const readableHighWaterMark = options ? getHighWaterMark(this, options, "readableHighWaterMark", true) : null;
      if (readableHighWaterMark === 0) {
        options = {
          ...options,
          highWaterMark: null,
          readableHighWaterMark,
          // TODO (ronag): 0 is not optimal since we have
          // a "bug" where we check needDrain before calling _write and not after.
          // Refs: https://github.com/nodejs/node/pull/32887
          // Refs: https://github.com/nodejs/node/pull/35941
          writableHighWaterMark: options.writableHighWaterMark || 0
        };
      }
      Duplex.call(this, options);
      this._readableState.sync = false;
      this[kCallback] = null;
      if (options) {
        if (typeof options.transform === "function") this._transform = options.transform;
        if (typeof options.flush === "function") this._flush = options.flush;
      }
      this.on("prefinish", prefinish);
    }
    function final(cb) {
      if (typeof this._flush === "function" && !this.destroyed) {
        this._flush((er, data) => {
          if (er) {
            if (cb) {
              cb(er);
            } else {
              this.destroy(er);
            }
            return;
          }
          if (data != null) {
            this.push(data);
          }
          this.push(null);
          if (cb) {
            cb();
          }
        });
      } else {
        this.push(null);
        if (cb) {
          cb();
        }
      }
    }
    function prefinish() {
      if (this._final !== final) {
        final.call(this);
      }
    }
    Transform.prototype._final = final;
    Transform.prototype._transform = function(chunk, encoding, callback) {
      throw new ERR_METHOD_NOT_IMPLEMENTED("_transform()");
    };
    Transform.prototype._write = function(chunk, encoding, callback) {
      const rState = this._readableState;
      const wState = this._writableState;
      const length = rState.length;
      this._transform(chunk, encoding, (err2, val) => {
        if (err2) {
          callback(err2);
          return;
        }
        if (val != null) {
          this.push(val);
        }
        if (wState.ended || // Backwards compat.
        length === rState.length || // Backwards compat.
        rState.length < rState.highWaterMark) {
          callback();
        } else {
          this[kCallback] = callback;
        }
      });
    };
    Transform.prototype._read = function() {
      if (this[kCallback]) {
        const callback = this[kCallback];
        this[kCallback] = null;
        callback();
      }
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/passthrough.js
var require_passthrough = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/passthrough.js"(exports, module) {
    "use strict";
    var { ObjectSetPrototypeOf } = require_primordials();
    module.exports = PassThrough;
    var Transform = require_transform();
    ObjectSetPrototypeOf(PassThrough.prototype, Transform.prototype);
    ObjectSetPrototypeOf(PassThrough, Transform);
    function PassThrough(options) {
      if (!(this instanceof PassThrough)) return new PassThrough(options);
      Transform.call(this, options);
    }
    PassThrough.prototype._transform = function(chunk, encoding, cb) {
      cb(null, chunk);
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/pipeline.js
var require_pipeline = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/pipeline.js"(exports, module) {
    var process2 = require_process();
    var { ArrayIsArray, Promise: Promise2, SymbolAsyncIterator, SymbolDispose } = require_primordials();
    var eos = require_end_of_stream();
    var { once } = require_util();
    var destroyImpl = require_destroy();
    var Duplex = require_duplex();
    var {
      aggregateTwoErrors,
      codes: {
        ERR_INVALID_ARG_TYPE,
        ERR_INVALID_RETURN_VALUE,
        ERR_MISSING_ARGS,
        ERR_STREAM_DESTROYED,
        ERR_STREAM_PREMATURE_CLOSE
      },
      AbortError
    } = require_errors();
    var { validateFunction, validateAbortSignal } = require_validators();
    var {
      isIterable,
      isReadable,
      isReadableNodeStream,
      isNodeStream,
      isTransformStream,
      isWebStream,
      isReadableStream,
      isReadableFinished
    } = require_utils();
    var AbortController = globalThis.AbortController || require_abort_controller().AbortController;
    var PassThrough;
    var Readable;
    var addAbortListener;
    function destroyer(stream, reading, writing) {
      let finished = false;
      stream.on("close", () => {
        finished = true;
      });
      const cleanup = eos(
        stream,
        {
          readable: reading,
          writable: writing
        },
        (err2) => {
          finished = !err2;
        }
      );
      return {
        destroy: (err2) => {
          if (finished) return;
          finished = true;
          destroyImpl.destroyer(stream, err2 || new ERR_STREAM_DESTROYED("pipe"));
        },
        cleanup
      };
    }
    function popCallback(streams) {
      validateFunction(streams[streams.length - 1], "streams[stream.length - 1]");
      return streams.pop();
    }
    function makeAsyncIterable(val) {
      if (isIterable(val)) {
        return val;
      } else if (isReadableNodeStream(val)) {
        return fromReadable(val);
      }
      throw new ERR_INVALID_ARG_TYPE("val", ["Readable", "Iterable", "AsyncIterable"], val);
    }
    async function* fromReadable(val) {
      if (!Readable) {
        Readable = require_readable();
      }
      yield* Readable.prototype[SymbolAsyncIterator].call(val);
    }
    async function pumpToNode(iterable, writable, finish, { end }) {
      let error2;
      let onresolve = null;
      const resume = (err2) => {
        if (err2) {
          error2 = err2;
        }
        if (onresolve) {
          const callback = onresolve;
          onresolve = null;
          callback();
        }
      };
      const wait = () => new Promise2((resolve3, reject) => {
        if (error2) {
          reject(error2);
        } else {
          onresolve = () => {
            if (error2) {
              reject(error2);
            } else {
              resolve3();
            }
          };
        }
      });
      writable.on("drain", resume);
      const cleanup = eos(
        writable,
        {
          readable: false
        },
        resume
      );
      try {
        if (writable.writableNeedDrain) {
          await wait();
        }
        for await (const chunk of iterable) {
          if (!writable.write(chunk)) {
            await wait();
          }
        }
        if (end) {
          writable.end();
          await wait();
        }
        finish();
      } catch (err2) {
        finish(error2 !== err2 ? aggregateTwoErrors(error2, err2) : err2);
      } finally {
        cleanup();
        writable.off("drain", resume);
      }
    }
    async function pumpToWeb(readable, writable, finish, { end }) {
      if (isTransformStream(writable)) {
        writable = writable.writable;
      }
      const writer = writable.getWriter();
      try {
        for await (const chunk of readable) {
          await writer.ready;
          writer.write(chunk).catch(() => {
          });
        }
        await writer.ready;
        if (end) {
          await writer.close();
        }
        finish();
      } catch (err2) {
        try {
          await writer.abort(err2);
          finish(err2);
        } catch (err3) {
          finish(err3);
        }
      }
    }
    function pipeline(...streams) {
      return pipelineImpl(streams, once(popCallback(streams)));
    }
    function pipelineImpl(streams, callback, opts) {
      if (streams.length === 1 && ArrayIsArray(streams[0])) {
        streams = streams[0];
      }
      if (streams.length < 2) {
        throw new ERR_MISSING_ARGS("streams");
      }
      const ac = new AbortController();
      const signal = ac.signal;
      const outerSignal = opts === null || opts === void 0 ? void 0 : opts.signal;
      const lastStreamCleanup = [];
      validateAbortSignal(outerSignal, "options.signal");
      function abort() {
        finishImpl(new AbortError());
      }
      addAbortListener = addAbortListener || require_util().addAbortListener;
      let disposable;
      if (outerSignal) {
        disposable = addAbortListener(outerSignal, abort);
      }
      let error2;
      let value;
      const destroys = [];
      let finishCount = 0;
      function finish(err2) {
        finishImpl(err2, --finishCount === 0);
      }
      function finishImpl(err2, final) {
        var _disposable;
        if (err2 && (!error2 || error2.code === "ERR_STREAM_PREMATURE_CLOSE")) {
          error2 = err2;
        }
        if (!error2 && !final) {
          return;
        }
        while (destroys.length) {
          destroys.shift()(error2);
        }
        ;
        (_disposable = disposable) === null || _disposable === void 0 ? void 0 : _disposable[SymbolDispose]();
        ac.abort();
        if (final) {
          if (!error2) {
            lastStreamCleanup.forEach((fn) => fn());
          }
          process2.nextTick(callback, error2, value);
        }
      }
      let ret;
      for (let i = 0; i < streams.length; i++) {
        const stream = streams[i];
        const reading = i < streams.length - 1;
        const writing = i > 0;
        const end = reading || (opts === null || opts === void 0 ? void 0 : opts.end) !== false;
        const isLastStream = i === streams.length - 1;
        if (isNodeStream(stream)) {
          let onError2 = function(err2) {
            if (err2 && err2.name !== "AbortError" && err2.code !== "ERR_STREAM_PREMATURE_CLOSE") {
              finish(err2);
            }
          };
          var onError = onError2;
          if (end) {
            const { destroy, cleanup } = destroyer(stream, reading, writing);
            destroys.push(destroy);
            if (isReadable(stream) && isLastStream) {
              lastStreamCleanup.push(cleanup);
            }
          }
          stream.on("error", onError2);
          if (isReadable(stream) && isLastStream) {
            lastStreamCleanup.push(() => {
              stream.removeListener("error", onError2);
            });
          }
        }
        if (i === 0) {
          if (typeof stream === "function") {
            ret = stream({
              signal
            });
            if (!isIterable(ret)) {
              throw new ERR_INVALID_RETURN_VALUE("Iterable, AsyncIterable or Stream", "source", ret);
            }
          } else if (isIterable(stream) || isReadableNodeStream(stream) || isTransformStream(stream)) {
            ret = stream;
          } else {
            ret = Duplex.from(stream);
          }
        } else if (typeof stream === "function") {
          if (isTransformStream(ret)) {
            var _ret;
            ret = makeAsyncIterable((_ret = ret) === null || _ret === void 0 ? void 0 : _ret.readable);
          } else {
            ret = makeAsyncIterable(ret);
          }
          ret = stream(ret, {
            signal
          });
          if (reading) {
            if (!isIterable(ret, true)) {
              throw new ERR_INVALID_RETURN_VALUE("AsyncIterable", `transform[${i - 1}]`, ret);
            }
          } else {
            var _ret2;
            if (!PassThrough) {
              PassThrough = require_passthrough();
            }
            const pt = new PassThrough({
              objectMode: true
            });
            const then = (_ret2 = ret) === null || _ret2 === void 0 ? void 0 : _ret2.then;
            if (typeof then === "function") {
              finishCount++;
              then.call(
                ret,
                (val) => {
                  value = val;
                  if (val != null) {
                    pt.write(val);
                  }
                  if (end) {
                    pt.end();
                  }
                  process2.nextTick(finish);
                },
                (err2) => {
                  pt.destroy(err2);
                  process2.nextTick(finish, err2);
                }
              );
            } else if (isIterable(ret, true)) {
              finishCount++;
              pumpToNode(ret, pt, finish, {
                end
              });
            } else if (isReadableStream(ret) || isTransformStream(ret)) {
              const toRead = ret.readable || ret;
              finishCount++;
              pumpToNode(toRead, pt, finish, {
                end
              });
            } else {
              throw new ERR_INVALID_RETURN_VALUE("AsyncIterable or Promise", "destination", ret);
            }
            ret = pt;
            const { destroy, cleanup } = destroyer(ret, false, true);
            destroys.push(destroy);
            if (isLastStream) {
              lastStreamCleanup.push(cleanup);
            }
          }
        } else if (isNodeStream(stream)) {
          if (isReadableNodeStream(ret)) {
            finishCount += 2;
            const cleanup = pipe(ret, stream, finish, {
              end
            });
            if (isReadable(stream) && isLastStream) {
              lastStreamCleanup.push(cleanup);
            }
          } else if (isTransformStream(ret) || isReadableStream(ret)) {
            const toRead = ret.readable || ret;
            finishCount++;
            pumpToNode(toRead, stream, finish, {
              end
            });
          } else if (isIterable(ret)) {
            finishCount++;
            pumpToNode(ret, stream, finish, {
              end
            });
          } else {
            throw new ERR_INVALID_ARG_TYPE(
              "val",
              ["Readable", "Iterable", "AsyncIterable", "ReadableStream", "TransformStream"],
              ret
            );
          }
          ret = stream;
        } else if (isWebStream(stream)) {
          if (isReadableNodeStream(ret)) {
            finishCount++;
            pumpToWeb(makeAsyncIterable(ret), stream, finish, {
              end
            });
          } else if (isReadableStream(ret) || isIterable(ret)) {
            finishCount++;
            pumpToWeb(ret, stream, finish, {
              end
            });
          } else if (isTransformStream(ret)) {
            finishCount++;
            pumpToWeb(ret.readable, stream, finish, {
              end
            });
          } else {
            throw new ERR_INVALID_ARG_TYPE(
              "val",
              ["Readable", "Iterable", "AsyncIterable", "ReadableStream", "TransformStream"],
              ret
            );
          }
          ret = stream;
        } else {
          ret = Duplex.from(stream);
        }
      }
      if (signal !== null && signal !== void 0 && signal.aborted || outerSignal !== null && outerSignal !== void 0 && outerSignal.aborted) {
        process2.nextTick(abort);
      }
      return ret;
    }
    function pipe(src, dst, finish, { end }) {
      let ended = false;
      dst.on("close", () => {
        if (!ended) {
          finish(new ERR_STREAM_PREMATURE_CLOSE());
        }
      });
      src.pipe(dst, {
        end: false
      });
      if (end) {
        let endFn2 = function() {
          ended = true;
          dst.end();
        };
        var endFn = endFn2;
        if (isReadableFinished(src)) {
          process2.nextTick(endFn2);
        } else {
          src.once("end", endFn2);
        }
      } else {
        finish();
      }
      eos(
        src,
        {
          readable: true,
          writable: false
        },
        (err2) => {
          const rState = src._readableState;
          if (err2 && err2.code === "ERR_STREAM_PREMATURE_CLOSE" && rState && rState.ended && !rState.errored && !rState.errorEmitted) {
            src.once("end", finish).once("error", finish);
          } else {
            finish(err2);
          }
        }
      );
      return eos(
        dst,
        {
          readable: false,
          writable: true
        },
        finish
      );
    }
    module.exports = {
      pipelineImpl,
      pipeline
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/compose.js
var require_compose = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/compose.js"(exports, module) {
    "use strict";
    var { pipeline } = require_pipeline();
    var Duplex = require_duplex();
    var { destroyer } = require_destroy();
    var {
      isNodeStream,
      isReadable,
      isWritable,
      isWebStream,
      isTransformStream,
      isWritableStream,
      isReadableStream
    } = require_utils();
    var {
      AbortError,
      codes: { ERR_INVALID_ARG_VALUE, ERR_MISSING_ARGS }
    } = require_errors();
    var eos = require_end_of_stream();
    module.exports = function compose2(...streams) {
      if (streams.length === 0) {
        throw new ERR_MISSING_ARGS("streams");
      }
      if (streams.length === 1) {
        return Duplex.from(streams[0]);
      }
      const orgStreams = [...streams];
      if (typeof streams[0] === "function") {
        streams[0] = Duplex.from(streams[0]);
      }
      if (typeof streams[streams.length - 1] === "function") {
        const idx = streams.length - 1;
        streams[idx] = Duplex.from(streams[idx]);
      }
      for (let n = 0; n < streams.length; ++n) {
        if (!isNodeStream(streams[n]) && !isWebStream(streams[n])) {
          continue;
        }
        if (n < streams.length - 1 && !(isReadable(streams[n]) || isReadableStream(streams[n]) || isTransformStream(streams[n]))) {
          throw new ERR_INVALID_ARG_VALUE(`streams[${n}]`, orgStreams[n], "must be readable");
        }
        if (n > 0 && !(isWritable(streams[n]) || isWritableStream(streams[n]) || isTransformStream(streams[n]))) {
          throw new ERR_INVALID_ARG_VALUE(`streams[${n}]`, orgStreams[n], "must be writable");
        }
      }
      let ondrain;
      let onfinish;
      let onreadable;
      let onclose;
      let d;
      function onfinished(err2) {
        const cb = onclose;
        onclose = null;
        if (cb) {
          cb(err2);
        } else if (err2) {
          d.destroy(err2);
        } else if (!readable && !writable) {
          d.destroy();
        }
      }
      const head = streams[0];
      const tail = pipeline(streams, onfinished);
      const writable = !!(isWritable(head) || isWritableStream(head) || isTransformStream(head));
      const readable = !!(isReadable(tail) || isReadableStream(tail) || isTransformStream(tail));
      d = new Duplex({
        // TODO (ronag): highWaterMark?
        writableObjectMode: !!(head !== null && head !== void 0 && head.writableObjectMode),
        readableObjectMode: !!(tail !== null && tail !== void 0 && tail.readableObjectMode),
        writable,
        readable
      });
      if (writable) {
        if (isNodeStream(head)) {
          d._write = function(chunk, encoding, callback) {
            if (head.write(chunk, encoding)) {
              callback();
            } else {
              ondrain = callback;
            }
          };
          d._final = function(callback) {
            head.end();
            onfinish = callback;
          };
          head.on("drain", function() {
            if (ondrain) {
              const cb = ondrain;
              ondrain = null;
              cb();
            }
          });
        } else if (isWebStream(head)) {
          const writable2 = isTransformStream(head) ? head.writable : head;
          const writer = writable2.getWriter();
          d._write = async function(chunk, encoding, callback) {
            try {
              await writer.ready;
              writer.write(chunk).catch(() => {
              });
              callback();
            } catch (err2) {
              callback(err2);
            }
          };
          d._final = async function(callback) {
            try {
              await writer.ready;
              writer.close().catch(() => {
              });
              onfinish = callback;
            } catch (err2) {
              callback(err2);
            }
          };
        }
        const toRead = isTransformStream(tail) ? tail.readable : tail;
        eos(toRead, () => {
          if (onfinish) {
            const cb = onfinish;
            onfinish = null;
            cb();
          }
        });
      }
      if (readable) {
        if (isNodeStream(tail)) {
          tail.on("readable", function() {
            if (onreadable) {
              const cb = onreadable;
              onreadable = null;
              cb();
            }
          });
          tail.on("end", function() {
            d.push(null);
          });
          d._read = function() {
            while (true) {
              const buf = tail.read();
              if (buf === null) {
                onreadable = d._read;
                return;
              }
              if (!d.push(buf)) {
                return;
              }
            }
          };
        } else if (isWebStream(tail)) {
          const readable2 = isTransformStream(tail) ? tail.readable : tail;
          const reader = readable2.getReader();
          d._read = async function() {
            while (true) {
              try {
                const { value, done } = await reader.read();
                if (!d.push(value)) {
                  return;
                }
                if (done) {
                  d.push(null);
                  return;
                }
              } catch {
                return;
              }
            }
          };
        }
      }
      d._destroy = function(err2, callback) {
        if (!err2 && onclose !== null) {
          err2 = new AbortError();
        }
        onreadable = null;
        ondrain = null;
        onfinish = null;
        if (onclose === null) {
          callback(err2);
        } else {
          onclose = callback;
          if (isNodeStream(tail)) {
            destroyer(tail, err2);
          }
        }
      };
      return d;
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/operators.js
var require_operators = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/internal/streams/operators.js"(exports, module) {
    "use strict";
    var AbortController = globalThis.AbortController || require_abort_controller().AbortController;
    var {
      codes: { ERR_INVALID_ARG_VALUE, ERR_INVALID_ARG_TYPE, ERR_MISSING_ARGS, ERR_OUT_OF_RANGE },
      AbortError
    } = require_errors();
    var { validateAbortSignal, validateInteger, validateObject } = require_validators();
    var kWeakHandler = require_primordials().Symbol("kWeak");
    var kResistStopPropagation = require_primordials().Symbol("kResistStopPropagation");
    var { finished } = require_end_of_stream();
    var staticCompose = require_compose();
    var { addAbortSignalNoValidate } = require_add_abort_signal();
    var { isWritable, isNodeStream } = require_utils();
    var { deprecate } = require_util();
    var {
      ArrayPrototypePush,
      Boolean: Boolean2,
      MathFloor,
      Number: Number2,
      NumberIsNaN,
      Promise: Promise2,
      PromiseReject,
      PromiseResolve,
      PromisePrototypeThen,
      Symbol: Symbol2
    } = require_primordials();
    var kEmpty = Symbol2("kEmpty");
    var kEof = Symbol2("kEof");
    function compose2(stream, options) {
      if (options != null) {
        validateObject(options, "options");
      }
      if ((options === null || options === void 0 ? void 0 : options.signal) != null) {
        validateAbortSignal(options.signal, "options.signal");
      }
      if (isNodeStream(stream) && !isWritable(stream)) {
        throw new ERR_INVALID_ARG_VALUE("stream", stream, "must be writable");
      }
      const composedStream = staticCompose(this, stream);
      if (options !== null && options !== void 0 && options.signal) {
        addAbortSignalNoValidate(options.signal, composedStream);
      }
      return composedStream;
    }
    function map(fn, options) {
      if (typeof fn !== "function") {
        throw new ERR_INVALID_ARG_TYPE("fn", ["Function", "AsyncFunction"], fn);
      }
      if (options != null) {
        validateObject(options, "options");
      }
      if ((options === null || options === void 0 ? void 0 : options.signal) != null) {
        validateAbortSignal(options.signal, "options.signal");
      }
      let concurrency = 1;
      if ((options === null || options === void 0 ? void 0 : options.concurrency) != null) {
        concurrency = MathFloor(options.concurrency);
      }
      let highWaterMark = concurrency - 1;
      if ((options === null || options === void 0 ? void 0 : options.highWaterMark) != null) {
        highWaterMark = MathFloor(options.highWaterMark);
      }
      validateInteger(concurrency, "options.concurrency", 1);
      validateInteger(highWaterMark, "options.highWaterMark", 0);
      highWaterMark += concurrency;
      return async function* map2() {
        const signal = require_util().AbortSignalAny(
          [options === null || options === void 0 ? void 0 : options.signal].filter(Boolean2)
        );
        const stream = this;
        const queue = [];
        const signalOpt = {
          signal
        };
        let next;
        let resume;
        let done = false;
        let cnt = 0;
        function onCatch() {
          done = true;
          afterItemProcessed();
        }
        function afterItemProcessed() {
          cnt -= 1;
          maybeResume();
        }
        function maybeResume() {
          if (resume && !done && cnt < concurrency && queue.length < highWaterMark) {
            resume();
            resume = null;
          }
        }
        async function pump() {
          try {
            for await (let val of stream) {
              if (done) {
                return;
              }
              if (signal.aborted) {
                throw new AbortError();
              }
              try {
                val = fn(val, signalOpt);
                if (val === kEmpty) {
                  continue;
                }
                val = PromiseResolve(val);
              } catch (err2) {
                val = PromiseReject(err2);
              }
              cnt += 1;
              PromisePrototypeThen(val, afterItemProcessed, onCatch);
              queue.push(val);
              if (next) {
                next();
                next = null;
              }
              if (!done && (queue.length >= highWaterMark || cnt >= concurrency)) {
                await new Promise2((resolve3) => {
                  resume = resolve3;
                });
              }
            }
            queue.push(kEof);
          } catch (err2) {
            const val = PromiseReject(err2);
            PromisePrototypeThen(val, afterItemProcessed, onCatch);
            queue.push(val);
          } finally {
            done = true;
            if (next) {
              next();
              next = null;
            }
          }
        }
        pump();
        try {
          while (true) {
            while (queue.length > 0) {
              const val = await queue[0];
              if (val === kEof) {
                return;
              }
              if (signal.aborted) {
                throw new AbortError();
              }
              if (val !== kEmpty) {
                yield val;
              }
              queue.shift();
              maybeResume();
            }
            await new Promise2((resolve3) => {
              next = resolve3;
            });
          }
        } finally {
          done = true;
          if (resume) {
            resume();
            resume = null;
          }
        }
      }.call(this);
    }
    function asIndexedPairs(options = void 0) {
      if (options != null) {
        validateObject(options, "options");
      }
      if ((options === null || options === void 0 ? void 0 : options.signal) != null) {
        validateAbortSignal(options.signal, "options.signal");
      }
      return async function* asIndexedPairs2() {
        let index = 0;
        for await (const val of this) {
          var _options$signal;
          if (options !== null && options !== void 0 && (_options$signal = options.signal) !== null && _options$signal !== void 0 && _options$signal.aborted) {
            throw new AbortError({
              cause: options.signal.reason
            });
          }
          yield [index++, val];
        }
      }.call(this);
    }
    async function some(fn, options = void 0) {
      for await (const unused of filter.call(this, fn, options)) {
        return true;
      }
      return false;
    }
    async function every(fn, options = void 0) {
      if (typeof fn !== "function") {
        throw new ERR_INVALID_ARG_TYPE("fn", ["Function", "AsyncFunction"], fn);
      }
      return !await some.call(
        this,
        async (...args) => {
          return !await fn(...args);
        },
        options
      );
    }
    async function find(fn, options) {
      for await (const result of filter.call(this, fn, options)) {
        return result;
      }
      return void 0;
    }
    async function forEach(fn, options) {
      if (typeof fn !== "function") {
        throw new ERR_INVALID_ARG_TYPE("fn", ["Function", "AsyncFunction"], fn);
      }
      async function forEachFn(value, options2) {
        await fn(value, options2);
        return kEmpty;
      }
      for await (const unused of map.call(this, forEachFn, options)) ;
    }
    function filter(fn, options) {
      if (typeof fn !== "function") {
        throw new ERR_INVALID_ARG_TYPE("fn", ["Function", "AsyncFunction"], fn);
      }
      async function filterFn(value, options2) {
        if (await fn(value, options2)) {
          return value;
        }
        return kEmpty;
      }
      return map.call(this, filterFn, options);
    }
    var ReduceAwareErrMissingArgs = class extends ERR_MISSING_ARGS {
      constructor() {
        super("reduce");
        this.message = "Reduce of an empty stream requires an initial value";
      }
    };
    async function reduce(reducer, initialValue, options) {
      var _options$signal2;
      if (typeof reducer !== "function") {
        throw new ERR_INVALID_ARG_TYPE("reducer", ["Function", "AsyncFunction"], reducer);
      }
      if (options != null) {
        validateObject(options, "options");
      }
      if ((options === null || options === void 0 ? void 0 : options.signal) != null) {
        validateAbortSignal(options.signal, "options.signal");
      }
      let hasInitialValue = arguments.length > 1;
      if (options !== null && options !== void 0 && (_options$signal2 = options.signal) !== null && _options$signal2 !== void 0 && _options$signal2.aborted) {
        const err2 = new AbortError(void 0, {
          cause: options.signal.reason
        });
        this.once("error", () => {
        });
        await finished(this.destroy(err2));
        throw err2;
      }
      const ac = new AbortController();
      const signal = ac.signal;
      if (options !== null && options !== void 0 && options.signal) {
        const opts = {
          once: true,
          [kWeakHandler]: this,
          [kResistStopPropagation]: true
        };
        options.signal.addEventListener("abort", () => ac.abort(), opts);
      }
      let gotAnyItemFromStream = false;
      try {
        for await (const value of this) {
          var _options$signal3;
          gotAnyItemFromStream = true;
          if (options !== null && options !== void 0 && (_options$signal3 = options.signal) !== null && _options$signal3 !== void 0 && _options$signal3.aborted) {
            throw new AbortError();
          }
          if (!hasInitialValue) {
            initialValue = value;
            hasInitialValue = true;
          } else {
            initialValue = await reducer(initialValue, value, {
              signal
            });
          }
        }
        if (!gotAnyItemFromStream && !hasInitialValue) {
          throw new ReduceAwareErrMissingArgs();
        }
      } finally {
        ac.abort();
      }
      return initialValue;
    }
    async function toArray2(options) {
      if (options != null) {
        validateObject(options, "options");
      }
      if ((options === null || options === void 0 ? void 0 : options.signal) != null) {
        validateAbortSignal(options.signal, "options.signal");
      }
      const result = [];
      for await (const val of this) {
        var _options$signal4;
        if (options !== null && options !== void 0 && (_options$signal4 = options.signal) !== null && _options$signal4 !== void 0 && _options$signal4.aborted) {
          throw new AbortError(void 0, {
            cause: options.signal.reason
          });
        }
        ArrayPrototypePush(result, val);
      }
      return result;
    }
    function flatMap2(fn, options) {
      const values = map.call(this, fn, options);
      return async function* flatMap3() {
        for await (const val of values) {
          yield* val;
        }
      }.call(this);
    }
    function toIntegerOrInfinity(number) {
      number = Number2(number);
      if (NumberIsNaN(number)) {
        return 0;
      }
      if (number < 0) {
        throw new ERR_OUT_OF_RANGE("number", ">= 0", number);
      }
      return number;
    }
    function drop(number, options = void 0) {
      if (options != null) {
        validateObject(options, "options");
      }
      if ((options === null || options === void 0 ? void 0 : options.signal) != null) {
        validateAbortSignal(options.signal, "options.signal");
      }
      number = toIntegerOrInfinity(number);
      return async function* drop2() {
        var _options$signal5;
        if (options !== null && options !== void 0 && (_options$signal5 = options.signal) !== null && _options$signal5 !== void 0 && _options$signal5.aborted) {
          throw new AbortError();
        }
        for await (const val of this) {
          var _options$signal6;
          if (options !== null && options !== void 0 && (_options$signal6 = options.signal) !== null && _options$signal6 !== void 0 && _options$signal6.aborted) {
            throw new AbortError();
          }
          if (number-- <= 0) {
            yield val;
          }
        }
      }.call(this);
    }
    function take2(number, options = void 0) {
      if (options != null) {
        validateObject(options, "options");
      }
      if ((options === null || options === void 0 ? void 0 : options.signal) != null) {
        validateAbortSignal(options.signal, "options.signal");
      }
      number = toIntegerOrInfinity(number);
      return async function* take3() {
        var _options$signal7;
        if (options !== null && options !== void 0 && (_options$signal7 = options.signal) !== null && _options$signal7 !== void 0 && _options$signal7.aborted) {
          throw new AbortError();
        }
        for await (const val of this) {
          var _options$signal8;
          if (options !== null && options !== void 0 && (_options$signal8 = options.signal) !== null && _options$signal8 !== void 0 && _options$signal8.aborted) {
            throw new AbortError();
          }
          if (number-- > 0) {
            yield val;
          }
          if (number <= 0) {
            return;
          }
        }
      }.call(this);
    }
    module.exports.streamReturningOperators = {
      asIndexedPairs: deprecate(asIndexedPairs, "readable.asIndexedPairs will be removed in a future version."),
      drop,
      filter,
      flatMap: flatMap2,
      map,
      take: take2,
      compose: compose2
    };
    module.exports.promiseReturningOperators = {
      every,
      forEach,
      reduce,
      toArray: toArray2,
      some,
      find
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/stream/promises.js
var require_promises = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/stream/promises.js"(exports, module) {
    "use strict";
    var { ArrayPrototypePop, Promise: Promise2 } = require_primordials();
    var { isIterable, isNodeStream, isWebStream } = require_utils();
    var { pipelineImpl: pl } = require_pipeline();
    var { finished } = require_end_of_stream();
    require_stream();
    function pipeline(...streams) {
      return new Promise2((resolve3, reject) => {
        let signal;
        let end;
        const lastArg = streams[streams.length - 1];
        if (lastArg && typeof lastArg === "object" && !isNodeStream(lastArg) && !isIterable(lastArg) && !isWebStream(lastArg)) {
          const options = ArrayPrototypePop(streams);
          signal = options.signal;
          end = options.end;
        }
        pl(
          streams,
          (err2, value) => {
            if (err2) {
              reject(err2);
            } else {
              resolve3(value);
            }
          },
          {
            signal,
            end
          }
        );
      });
    }
    module.exports = {
      finished,
      pipeline
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/stream.js
var require_stream = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/stream.js"(exports, module) {
    "use strict";
    var { Buffer: Buffer2 } = __require("buffer");
    var { ObjectDefineProperty, ObjectKeys, ReflectApply } = require_primordials();
    var {
      promisify: { custom: customPromisify }
    } = require_util();
    var { streamReturningOperators, promiseReturningOperators } = require_operators();
    var {
      codes: { ERR_ILLEGAL_CONSTRUCTOR }
    } = require_errors();
    var compose2 = require_compose();
    var { setDefaultHighWaterMark, getDefaultHighWaterMark } = require_state();
    var { pipeline } = require_pipeline();
    var { destroyer } = require_destroy();
    var eos = require_end_of_stream();
    var promises = require_promises();
    var utils = require_utils();
    var Stream = module.exports = require_legacy().Stream;
    Stream.isDestroyed = utils.isDestroyed;
    Stream.isDisturbed = utils.isDisturbed;
    Stream.isErrored = utils.isErrored;
    Stream.isReadable = utils.isReadable;
    Stream.isWritable = utils.isWritable;
    Stream.Readable = require_readable();
    for (const key of ObjectKeys(streamReturningOperators)) {
      let fn = function(...args) {
        if (new.target) {
          throw ERR_ILLEGAL_CONSTRUCTOR();
        }
        return Stream.Readable.from(ReflectApply(op, this, args));
      };
      const op = streamReturningOperators[key];
      ObjectDefineProperty(fn, "name", {
        __proto__: null,
        value: op.name
      });
      ObjectDefineProperty(fn, "length", {
        __proto__: null,
        value: op.length
      });
      ObjectDefineProperty(Stream.Readable.prototype, key, {
        __proto__: null,
        value: fn,
        enumerable: false,
        configurable: true,
        writable: true
      });
    }
    for (const key of ObjectKeys(promiseReturningOperators)) {
      let fn = function(...args) {
        if (new.target) {
          throw ERR_ILLEGAL_CONSTRUCTOR();
        }
        return ReflectApply(op, this, args);
      };
      const op = promiseReturningOperators[key];
      ObjectDefineProperty(fn, "name", {
        __proto__: null,
        value: op.name
      });
      ObjectDefineProperty(fn, "length", {
        __proto__: null,
        value: op.length
      });
      ObjectDefineProperty(Stream.Readable.prototype, key, {
        __proto__: null,
        value: fn,
        enumerable: false,
        configurable: true,
        writable: true
      });
    }
    Stream.Writable = require_writable();
    Stream.Duplex = require_duplex();
    Stream.Transform = require_transform();
    Stream.PassThrough = require_passthrough();
    Stream.pipeline = pipeline;
    var { addAbortSignal } = require_add_abort_signal();
    Stream.addAbortSignal = addAbortSignal;
    Stream.finished = eos;
    Stream.destroy = destroyer;
    Stream.compose = compose2;
    Stream.setDefaultHighWaterMark = setDefaultHighWaterMark;
    Stream.getDefaultHighWaterMark = getDefaultHighWaterMark;
    ObjectDefineProperty(Stream, "promises", {
      __proto__: null,
      configurable: true,
      enumerable: true,
      get() {
        return promises;
      }
    });
    ObjectDefineProperty(pipeline, customPromisify, {
      __proto__: null,
      enumerable: true,
      get() {
        return promises.pipeline;
      }
    });
    ObjectDefineProperty(eos, customPromisify, {
      __proto__: null,
      enumerable: true,
      get() {
        return promises.finished;
      }
    });
    Stream.Stream = Stream;
    Stream._isUint8Array = function isUint8Array(value) {
      return value instanceof Uint8Array;
    };
    Stream._uint8ArrayToBuffer = function _uint8ArrayToBuffer(chunk) {
      return Buffer2.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    };
  }
});

// ../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/ours/index.js
var require_ours = __commonJS({
  "../../node_modules/.pnpm/readable-stream@4.7.0/node_modules/readable-stream/lib/ours/index.js"(exports, module) {
    "use strict";
    var Stream = __require("stream");
    if (Stream && process.env.READABLE_STREAM === "disable") {
      const promises = Stream.promises;
      module.exports._uint8ArrayToBuffer = Stream._uint8ArrayToBuffer;
      module.exports._isUint8Array = Stream._isUint8Array;
      module.exports.isDisturbed = Stream.isDisturbed;
      module.exports.isErrored = Stream.isErrored;
      module.exports.isReadable = Stream.isReadable;
      module.exports.Readable = Stream.Readable;
      module.exports.Writable = Stream.Writable;
      module.exports.Duplex = Stream.Duplex;
      module.exports.Transform = Stream.Transform;
      module.exports.PassThrough = Stream.PassThrough;
      module.exports.addAbortSignal = Stream.addAbortSignal;
      module.exports.finished = Stream.finished;
      module.exports.destroy = Stream.destroy;
      module.exports.pipeline = Stream.pipeline;
      module.exports.compose = Stream.compose;
      Object.defineProperty(Stream, "promises", {
        configurable: true,
        enumerable: true,
        get() {
          return promises;
        }
      });
      module.exports.Stream = Stream.Stream;
    } else {
      const CustomStream = require_stream();
      const promises = require_promises();
      const originalDestroy = CustomStream.Readable.destroy;
      module.exports = CustomStream.Readable;
      module.exports._uint8ArrayToBuffer = CustomStream._uint8ArrayToBuffer;
      module.exports._isUint8Array = CustomStream._isUint8Array;
      module.exports.isDisturbed = CustomStream.isDisturbed;
      module.exports.isErrored = CustomStream.isErrored;
      module.exports.isReadable = CustomStream.isReadable;
      module.exports.Readable = CustomStream.Readable;
      module.exports.Writable = CustomStream.Writable;
      module.exports.Duplex = CustomStream.Duplex;
      module.exports.Transform = CustomStream.Transform;
      module.exports.PassThrough = CustomStream.PassThrough;
      module.exports.addAbortSignal = CustomStream.addAbortSignal;
      module.exports.finished = CustomStream.finished;
      module.exports.destroy = CustomStream.destroy;
      module.exports.destroy = originalDestroy;
      module.exports.pipeline = CustomStream.pipeline;
      module.exports.compose = CustomStream.compose;
      Object.defineProperty(CustomStream, "promises", {
        configurable: true,
        enumerable: true,
        get() {
          return promises;
        }
      });
      module.exports.Stream = CustomStream.Stream;
    }
    module.exports.default = module.exports;
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Store.js
var require_N3Store = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Store.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = exports.N3EntityIndex = void 0;
    var _readableStream = require_ours();
    var _N3DataFactory = _interopRequireWildcard(require_N3DataFactory());
    var _IRIs = _interopRequireDefault(require_IRIs());
    var _N3Util = require_N3Util();
    var _N3Writer = _interopRequireDefault(require_N3Writer());
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : { default: e };
    }
    function _interopRequireWildcard(e, t) {
      if ("function" == typeof WeakMap) var r = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap();
      return (_interopRequireWildcard = function(e2, t2) {
        if (!t2 && e2 && e2.__esModule) return e2;
        var o, i, f = { __proto__: null, default: e2 };
        if (null === e2 || "object" != typeof e2 && "function" != typeof e2) return f;
        if (o = t2 ? n : r) {
          if (o.has(e2)) return o.get(e2);
          o.set(e2, f);
        }
        for (const t3 in e2) "default" !== t3 && {}.hasOwnProperty.call(e2, t3) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e2, t3)) && (i.get || i.set) ? o(f, t3, i) : f[t3] = e2[t3]);
        return f;
      })(e, t);
    }
    var ITERATOR = /* @__PURE__ */ Symbol("iter");
    function merge(target, source, depth = 4) {
      if (depth === 0) return Object.assign(target, source);
      for (const key in source) target[key] = merge(target[key] || /* @__PURE__ */ Object.create(null), source[key], depth - 1);
      return target;
    }
    function intersect(s1, s2, depth = 4) {
      let target = false;
      for (const key in s1) {
        if (key in s2) {
          const intersection = depth === 0 ? null : intersect(s1[key], s2[key], depth - 1);
          if (intersection !== false) {
            target = target || /* @__PURE__ */ Object.create(null);
            target[key] = intersection;
          } else if (depth === 3) {
            return false;
          }
        }
      }
      return target;
    }
    function difference(s1, s2, depth = 4) {
      let target = false;
      for (const key in s1) {
        if (!(key in s2)) {
          target = target || /* @__PURE__ */ Object.create(null);
          target[key] = depth === 0 ? null : merge({}, s1[key], depth - 1);
        } else if (depth !== 0) {
          const diff = difference(s1[key], s2[key], depth - 1);
          if (diff !== false) {
            target = target || /* @__PURE__ */ Object.create(null);
            target[key] = diff;
          } else if (depth === 3) {
            return false;
          }
        }
      }
      return target;
    }
    var N3EntityIndex = class {
      constructor(options = {}) {
        this._id = 1;
        this._ids = /* @__PURE__ */ Object.create(null);
        this._ids[""] = 1;
        this._entities = /* @__PURE__ */ Object.create(null);
        this._entities[1] = "";
        this._blankNodeIndex = 0;
        this._factory = options.factory || _N3DataFactory.default;
      }
      _termFromId(id) {
        if (id[0] === ".") {
          const entities = this._entities;
          const terms = id.split(".");
          const q = this._factory.quad(this._termFromId(entities[terms[1]]), this._termFromId(entities[terms[2]]), this._termFromId(entities[terms[3]]), terms[4] && this._termFromId(entities[terms[4]]));
          return q;
        }
        return (0, _N3DataFactory.termFromId)(id, this._factory);
      }
      _termToNumericId(term2) {
        if (term2.termType === "Quad") {
          const s = this._termToNumericId(term2.subject), p = this._termToNumericId(term2.predicate), o = this._termToNumericId(term2.object);
          let g;
          return s && p && o && ((0, _N3Util.isDefaultGraph)(term2.graph) || (g = this._termToNumericId(term2.graph))) && this._ids[g ? `.${s}.${p}.${o}.${g}` : `.${s}.${p}.${o}`];
        }
        return this._ids[(0, _N3DataFactory.termToId)(term2)];
      }
      _termToNewNumericId(term2) {
        const str = term2 && term2.termType === "Quad" ? `.${this._termToNewNumericId(term2.subject)}.${this._termToNewNumericId(term2.predicate)}.${this._termToNewNumericId(term2.object)}${(0, _N3Util.isDefaultGraph)(term2.graph) ? "" : `.${this._termToNewNumericId(term2.graph)}`}` : (0, _N3DataFactory.termToId)(term2);
        return this._ids[str] || (this._ids[this._entities[++this._id] = str] = this._id);
      }
      createBlankNode(suggestedName) {
        let name, index;
        if (suggestedName) {
          name = suggestedName = `_:${suggestedName}`, index = 1;
          while (this._ids[name]) name = suggestedName + index++;
        } else {
          do {
            name = `_:b${this._blankNodeIndex++}`;
          } while (this._ids[name]);
        }
        this._ids[name] = ++this._id;
        this._entities[this._id] = name;
        return this._factory.blankNode(name.substr(2));
      }
    };
    exports.N3EntityIndex = N3EntityIndex;
    var N3Store = class _N3Store {
      constructor(quads, options) {
        this._size = 0;
        this._graphs = /* @__PURE__ */ Object.create(null);
        if (!options && quads && !quads[0] && !(typeof quads.match === "function")) options = quads, quads = null;
        options = options || {};
        this._factory = options.factory || _N3DataFactory.default;
        this._entityIndex = options.entityIndex || new N3EntityIndex({
          factory: this._factory
        });
        this._entities = this._entityIndex._entities;
        this._termFromId = this._entityIndex._termFromId.bind(this._entityIndex);
        this._termToNumericId = this._entityIndex._termToNumericId.bind(this._entityIndex);
        this._termToNewNumericId = this._entityIndex._termToNewNumericId.bind(this._entityIndex);
        if (quads) this.addAll(quads);
      }
      // ## Public properties
      // ### `size` returns the number of quads in the store
      get size() {
        let size = this._size;
        if (size !== null) return size;
        size = 0;
        const graphs = this._graphs;
        let subjects, subject;
        for (const graphKey in graphs) for (const subjectKey in subjects = graphs[graphKey].subjects) for (const predicateKey in subject = subjects[subjectKey]) size += Object.keys(subject[predicateKey]).length;
        return this._size = size;
      }
      // ## Private methods
      // ### `_addToIndex` adds a quad to a three-layered index.
      // Returns if the index has changed, if the entry did not already exist.
      _addToIndex(index0, key0, key1, key2) {
        const index1 = index0[key0] || (index0[key0] = {});
        const index2 = index1[key1] || (index1[key1] = {});
        const existed = key2 in index2;
        if (!existed) index2[key2] = null;
        return !existed;
      }
      // ### `_removeFromIndex` removes a quad from a three-layered index
      _removeFromIndex(index0, key0, key1, key2) {
        const index1 = index0[key0], index2 = index1[key1];
        delete index2[key2];
        for (const key in index2) return;
        delete index1[key1];
        for (const key in index1) return;
        delete index0[key0];
      }
      // ### `_findInIndex` finds a set of quads in a three-layered index.
      // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
      // Any of these keys can be undefined, which is interpreted as a wildcard.
      // `name0`, `name1`, and `name2` are the names of the keys at each level,
      // used when reconstructing the resulting quad
      // (for instance: _subject_, _predicate_, and _object_).
      // Finally, `graphId` will be the graph of the created quads.
      *_findInIndex(index0, key0, key1, key2, name0, name1, name2, graphId) {
        let tmp, index1, index2;
        const entityKeys = this._entities;
        const graph = this._termFromId(entityKeys[graphId]);
        const parts = {
          subject: null,
          predicate: null,
          object: null
        };
        if (key0) (tmp = index0, index0 = {})[key0] = tmp[key0];
        for (const value0 in index0) {
          if (index1 = index0[value0]) {
            parts[name0] = this._termFromId(entityKeys[value0]);
            if (key1) (tmp = index1, index1 = {})[key1] = tmp[key1];
            for (const value1 in index1) {
              if (index2 = index1[value1]) {
                parts[name1] = this._termFromId(entityKeys[value1]);
                const values = key2 ? key2 in index2 ? [key2] : [] : Object.keys(index2);
                for (let l = 0; l < values.length; l++) {
                  parts[name2] = this._termFromId(entityKeys[values[l]]);
                  yield this._factory.quad(parts.subject, parts.predicate, parts.object, graph);
                }
              }
            }
          }
        }
      }
      // ### `_loop` executes the callback on all keys of index 0
      _loop(index0, callback) {
        for (const key0 in index0) callback(key0);
      }
      // ### `_loopByKey0` executes the callback on all keys of a certain entry in index 0
      _loopByKey0(index0, key0, callback) {
        let index1, key1;
        if (index1 = index0[key0]) {
          for (key1 in index1) callback(key1);
        }
      }
      // ### `_loopByKey1` executes the callback on given keys of all entries in index 0
      _loopByKey1(index0, key1, callback) {
        let key0, index1;
        for (key0 in index0) {
          index1 = index0[key0];
          if (index1[key1]) callback(key0);
        }
      }
      // ### `_loopBy2Keys` executes the callback on given keys of certain entries in index 2
      _loopBy2Keys(index0, key0, key1, callback) {
        let index1, index2, key2;
        if ((index1 = index0[key0]) && (index2 = index1[key1])) {
          for (key2 in index2) callback(key2);
        }
      }
      // ### `_countInIndex` counts matching quads in a three-layered index.
      // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
      // Any of these keys can be undefined, which is interpreted as a wildcard.
      _countInIndex(index0, key0, key1, key2) {
        let count = 0, tmp, index1, index2;
        if (key0) (tmp = index0, index0 = {})[key0] = tmp[key0];
        for (const value0 in index0) {
          if (index1 = index0[value0]) {
            if (key1) (tmp = index1, index1 = {})[key1] = tmp[key1];
            for (const value1 in index1) {
              if (index2 = index1[value1]) {
                if (key2) key2 in index2 && count++;
                else count += Object.keys(index2).length;
              }
            }
          }
        }
        return count;
      }
      // ### `_getGraphs` returns an array with the given graph,
      // or all graphs if the argument is null or undefined.
      _getGraphs(graph) {
        graph = graph === "" ? 1 : graph && (this._termToNumericId(graph) || -1);
        return typeof graph !== "number" ? this._graphs : {
          [graph]: this._graphs[graph]
        };
      }
      // ### `_uniqueEntities` returns a function that accepts an entity ID
      // and passes the corresponding entity to callback if it hasn't occurred before.
      _uniqueEntities(callback) {
        const uniqueIds = /* @__PURE__ */ Object.create(null);
        return (id) => {
          if (!(id in uniqueIds)) {
            uniqueIds[id] = true;
            callback(this._termFromId(this._entities[id], this._factory));
          }
        };
      }
      // ## Public methods
      // ### `add` adds the specified quad to the dataset.
      // Returns the dataset instance it was called on.
      // Existing quads, as defined in Quad.equals, will be ignored.
      add(quad2) {
        this.addQuad(quad2);
        return this;
      }
      // ### `addQuad` adds a new quad to the store.
      // Returns if the quad index has changed, if the quad did not already exist.
      addQuad(subject, predicate, object, graph) {
        if (!predicate) graph = subject.graph, object = subject.object, predicate = subject.predicate, subject = subject.subject;
        graph = graph ? this._termToNewNumericId(graph) : 1;
        let graphItem = this._graphs[graph];
        if (!graphItem) {
          graphItem = this._graphs[graph] = {
            subjects: {},
            predicates: {},
            objects: {}
          };
          Object.freeze(graphItem);
        }
        subject = this._termToNewNumericId(subject);
        predicate = this._termToNewNumericId(predicate);
        object = this._termToNewNumericId(object);
        if (!this._addToIndex(graphItem.subjects, subject, predicate, object)) return false;
        this._addToIndex(graphItem.predicates, predicate, object, subject);
        this._addToIndex(graphItem.objects, object, subject, predicate);
        this._size = null;
        return true;
      }
      // ### `addQuads` adds multiple quads to the store
      addQuads(quads) {
        for (let i = 0; i < quads.length; i++) this.addQuad(quads[i]);
      }
      // ### `delete` removes the specified quad from the dataset.
      // Returns the dataset instance it was called on.
      delete(quad2) {
        this.removeQuad(quad2);
        return this;
      }
      // ### `has` determines whether a dataset includes a certain quad or quad pattern.
      has(subjectOrQuad, predicate, object, graph) {
        if (subjectOrQuad && subjectOrQuad.subject) ({
          subject: subjectOrQuad,
          predicate,
          object,
          graph
        } = subjectOrQuad);
        return !this.readQuads(subjectOrQuad, predicate, object, graph).next().done;
      }
      // ### `import` adds a stream of quads to the store
      import(stream) {
        stream.on("data", (quad2) => {
          this.addQuad(quad2);
        });
        return stream;
      }
      // ### `removeQuad` removes a quad from the store if it exists
      removeQuad(subject, predicate, object, graph) {
        if (!predicate) ({
          subject,
          predicate,
          object,
          graph
        } = subject);
        graph = graph ? this._termToNumericId(graph) : 1;
        const graphs = this._graphs;
        let graphItem, subjects, predicates;
        if (!(subject = subject && this._termToNumericId(subject)) || !(predicate = predicate && this._termToNumericId(predicate)) || !(object = object && this._termToNumericId(object)) || !(graphItem = graphs[graph]) || !(subjects = graphItem.subjects[subject]) || !(predicates = subjects[predicate]) || !(object in predicates)) return false;
        this._removeFromIndex(graphItem.subjects, subject, predicate, object);
        this._removeFromIndex(graphItem.predicates, predicate, object, subject);
        this._removeFromIndex(graphItem.objects, object, subject, predicate);
        if (this._size !== null) this._size--;
        for (subject in graphItem.subjects) return true;
        delete graphs[graph];
        return true;
      }
      // ### `removeQuads` removes multiple quads from the store
      removeQuads(quads) {
        for (let i = 0; i < quads.length; i++) this.removeQuad(quads[i]);
      }
      // ### `remove` removes a stream of quads from the store
      remove(stream) {
        stream.on("data", (quad2) => {
          this.removeQuad(quad2);
        });
        return stream;
      }
      // ### `removeMatches` removes all matching quads from the store
      // Setting any field to `undefined` or `null` indicates a wildcard.
      removeMatches(subject, predicate, object, graph) {
        const stream = new _readableStream.Readable({
          objectMode: true
        });
        const iterable = this.readQuads(subject, predicate, object, graph);
        stream._read = (size) => {
          while (--size >= 0) {
            const {
              done,
              value
            } = iterable.next();
            if (done) {
              stream.push(null);
              return;
            }
            stream.push(value);
          }
        };
        return this.remove(stream);
      }
      // ### `deleteGraph` removes all triples with the given graph from the store
      deleteGraph(graph) {
        return this.removeMatches(null, null, null, graph);
      }
      // ### `getQuads` returns an array of quads matching a pattern.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      getQuads(subject, predicate, object, graph) {
        return [...this.readQuads(subject, predicate, object, graph)];
      }
      /**
       * `readQuads` returns a generator of quads matching a pattern.
       * Setting any field to `undefined` or `null` indicates a wildcard.
       * @deprecated Use `match` instead.
       */
      *readQuads(subject, predicate, object, graph) {
        const graphs = this._getGraphs(graph);
        let content, subjectId, predicateId, objectId;
        if (subject && !(subjectId = this._termToNumericId(subject)) || predicate && !(predicateId = this._termToNumericId(predicate)) || object && !(objectId = this._termToNumericId(object))) return;
        for (const graphId in graphs) {
          if (content = graphs[graphId]) {
            if (subjectId) {
              if (objectId)
                yield* this._findInIndex(content.objects, objectId, subjectId, predicateId, "object", "subject", "predicate", graphId);
              else
                yield* this._findInIndex(content.subjects, subjectId, predicateId, null, "subject", "predicate", "object", graphId);
            } else if (predicateId)
              yield* this._findInIndex(content.predicates, predicateId, objectId, null, "predicate", "object", "subject", graphId);
            else if (objectId)
              yield* this._findInIndex(content.objects, objectId, null, null, "object", "subject", "predicate", graphId);
            else
              yield* this._findInIndex(content.subjects, null, null, null, "subject", "predicate", "object", graphId);
          }
        }
      }
      // ### `match` returns a new dataset that is comprised of all quads in the current instance matching the given arguments.
      // The logic described in Quad Matching is applied for each quad in this dataset to check if it should be included in the output dataset.
      // Note: This method always returns a new DatasetCore, even if that dataset contains no quads.
      // Note: Since a DatasetCore is an unordered set, the order of the quads within the returned sequence is arbitrary.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      // For backwards compatibility, the object return also implements the Readable stream interface.
      match(subject, predicate, object, graph) {
        return new DatasetCoreAndReadableStream(this, subject, predicate, object, graph, {
          entityIndex: this._entityIndex
        });
      }
      // ### `countQuads` returns the number of quads matching a pattern.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      countQuads(subject, predicate, object, graph) {
        const graphs = this._getGraphs(graph);
        let count = 0, content, subjectId, predicateId, objectId;
        if (subject && !(subjectId = this._termToNumericId(subject)) || predicate && !(predicateId = this._termToNumericId(predicate)) || object && !(objectId = this._termToNumericId(object))) return 0;
        for (const graphId in graphs) {
          if (content = graphs[graphId]) {
            if (subject) {
              if (object)
                count += this._countInIndex(content.objects, objectId, subjectId, predicateId);
              else
                count += this._countInIndex(content.subjects, subjectId, predicateId, objectId);
            } else if (predicate) {
              count += this._countInIndex(content.predicates, predicateId, objectId, subjectId);
            } else {
              count += this._countInIndex(content.objects, objectId, subjectId, predicateId);
            }
          }
        }
        return count;
      }
      // ### `forEach` executes the callback on all quads.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      forEach(callback, subject, predicate, object, graph) {
        this.some((quad2) => {
          callback(quad2, this);
          return false;
        }, subject, predicate, object, graph);
      }
      // ### `every` executes the callback on all quads,
      // and returns `true` if it returns truthy for all them.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      every(callback, subject, predicate, object, graph) {
        return !this.some((quad2) => !callback(quad2, this), subject, predicate, object, graph);
      }
      // ### `some` executes the callback on all quads,
      // and returns `true` if it returns truthy for any of them.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      some(callback, subject, predicate, object, graph) {
        for (const quad2 of this.readQuads(subject, predicate, object, graph)) if (callback(quad2, this)) return true;
        return false;
      }
      // ### `getSubjects` returns all subjects that match the pattern.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      getSubjects(predicate, object, graph) {
        const results = [];
        this.forSubjects((s) => {
          results.push(s);
        }, predicate, object, graph);
        return results;
      }
      // ### `forSubjects` executes the callback on all subjects that match the pattern.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      forSubjects(callback, predicate, object, graph) {
        const graphs = this._getGraphs(graph);
        let content, predicateId, objectId;
        callback = this._uniqueEntities(callback);
        if (predicate && !(predicateId = this._termToNumericId(predicate)) || object && !(objectId = this._termToNumericId(object))) return;
        for (graph in graphs) {
          if (content = graphs[graph]) {
            if (predicateId) {
              if (objectId)
                this._loopBy2Keys(content.predicates, predicateId, objectId, callback);
              else
                this._loopByKey1(content.subjects, predicateId, callback);
            } else if (objectId)
              this._loopByKey0(content.objects, objectId, callback);
            else
              this._loop(content.subjects, callback);
          }
        }
      }
      // ### `getPredicates` returns all predicates that match the pattern.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      getPredicates(subject, object, graph) {
        const results = [];
        this.forPredicates((p) => {
          results.push(p);
        }, subject, object, graph);
        return results;
      }
      // ### `forPredicates` executes the callback on all predicates that match the pattern.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      forPredicates(callback, subject, object, graph) {
        const graphs = this._getGraphs(graph);
        let content, subjectId, objectId;
        callback = this._uniqueEntities(callback);
        if (subject && !(subjectId = this._termToNumericId(subject)) || object && !(objectId = this._termToNumericId(object))) return;
        for (graph in graphs) {
          if (content = graphs[graph]) {
            if (subjectId) {
              if (objectId)
                this._loopBy2Keys(content.objects, objectId, subjectId, callback);
              else
                this._loopByKey0(content.subjects, subjectId, callback);
            } else if (objectId)
              this._loopByKey1(content.predicates, objectId, callback);
            else
              this._loop(content.predicates, callback);
          }
        }
      }
      // ### `getObjects` returns all objects that match the pattern.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      getObjects(subject, predicate, graph) {
        const results = [];
        this.forObjects((o) => {
          results.push(o);
        }, subject, predicate, graph);
        return results;
      }
      // ### `forObjects` executes the callback on all objects that match the pattern.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      forObjects(callback, subject, predicate, graph) {
        const graphs = this._getGraphs(graph);
        let content, subjectId, predicateId;
        callback = this._uniqueEntities(callback);
        if (subject && !(subjectId = this._termToNumericId(subject)) || predicate && !(predicateId = this._termToNumericId(predicate))) return;
        for (graph in graphs) {
          if (content = graphs[graph]) {
            if (subjectId) {
              if (predicateId)
                this._loopBy2Keys(content.subjects, subjectId, predicateId, callback);
              else
                this._loopByKey1(content.objects, subjectId, callback);
            } else if (predicateId)
              this._loopByKey0(content.predicates, predicateId, callback);
            else
              this._loop(content.objects, callback);
          }
        }
      }
      // ### `getGraphs` returns all graphs that match the pattern.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      getGraphs(subject, predicate, object) {
        const results = [];
        this.forGraphs((g) => {
          results.push(g);
        }, subject, predicate, object);
        return results;
      }
      // ### `forGraphs` executes the callback on all graphs that match the pattern.
      // Setting any field to `undefined` or `null` indicates a wildcard.
      forGraphs(callback, subject, predicate, object) {
        for (const graph in this._graphs) {
          this.some((quad2) => {
            callback(quad2.graph);
            return true;
          }, subject, predicate, object, this._termFromId(this._entities[graph]));
        }
      }
      // ### `createBlankNode` creates a new blank node, returning its name
      createBlankNode(suggestedName) {
        return this._entityIndex.createBlankNode(suggestedName);
      }
      // ### `extractLists` finds and removes all list triples
      // and returns the items per list.
      extractLists({
        remove = false,
        ignoreErrors = false
      } = {}) {
        const lists = {};
        const onError = ignoreErrors ? () => true : (node, message) => {
          throw new Error(`${node.value} ${message}`);
        };
        const tails = this.getQuads(null, _IRIs.default.rdf.rest, _IRIs.default.rdf.nil, null);
        const toRemove = remove ? [...tails] : [];
        tails.forEach((tailQuad) => {
          const items = [];
          let malformed = false;
          let head;
          let headPos;
          const graph = tailQuad.graph;
          let current = tailQuad.subject;
          while (current && !malformed) {
            const objectQuads = this.getQuads(null, null, current, null);
            const subjectQuads = this.getQuads(current, null, null, null);
            let quad2, first = null, rest = null, parent = null;
            for (let i = 0; i < subjectQuads.length && !malformed; i++) {
              quad2 = subjectQuads[i];
              if (!quad2.graph.equals(graph)) malformed = onError(current, "not confined to single graph");
              else if (head) malformed = onError(current, "has non-list arcs out");
              else if (quad2.predicate.value === _IRIs.default.rdf.first) {
                if (first) malformed = onError(current, "has multiple rdf:first arcs");
                else toRemove.push(first = quad2);
              } else if (quad2.predicate.value === _IRIs.default.rdf.rest) {
                if (rest) malformed = onError(current, "has multiple rdf:rest arcs");
                else toRemove.push(rest = quad2);
              } else if (objectQuads.length) malformed = onError(current, "can't be subject and object");
              else {
                head = quad2;
                headPos = "subject";
              }
            }
            for (let i = 0; i < objectQuads.length && !malformed; ++i) {
              quad2 = objectQuads[i];
              if (head) malformed = onError(current, "can't have coreferences");
              else if (quad2.predicate.value === _IRIs.default.rdf.rest) {
                if (parent) malformed = onError(current, "has incoming rdf:rest arcs");
                else parent = quad2;
              } else {
                head = quad2;
                headPos = "object";
              }
            }
            if (!first) malformed = onError(current, "has no list head");
            else items.unshift(first.object);
            current = parent && parent.subject;
          }
          if (malformed) remove = false;
          else if (head) lists[head[headPos].value] = items;
        });
        if (remove) this.removeQuads(toRemove);
        return lists;
      }
      /**
       * Returns `true` if the current dataset is a superset of the given dataset; in other words, returns `true` if
       * the given dataset is a subset of, i.e., is contained within, the current dataset.
       *
       * Blank Nodes will be normalized.
       */
      addAll(quads) {
        if (quads instanceof DatasetCoreAndReadableStream) quads = quads.filtered;
        if (Array.isArray(quads)) this.addQuads(quads);
        else if (quads instanceof _N3Store && quads._entityIndex === this._entityIndex) {
          if (quads._size !== 0) {
            this._graphs = merge(this._graphs, quads._graphs);
            this._size = null;
          }
        } else {
          for (const quad2 of quads) this.add(quad2);
        }
        return this;
      }
      /**
       * Returns `true` if the current dataset is a superset of the given dataset; in other words, returns `true` if
       * the given dataset is a subset of, i.e., is contained within, the current dataset.
       *
       * Blank Nodes will be normalized.
       */
      contains(other) {
        if (other instanceof DatasetCoreAndReadableStream) other = other.filtered;
        if (other === this) return true;
        if (!(other instanceof _N3Store) || this._entityIndex !== other._entityIndex) return other.every((quad2) => this.has(quad2));
        const g1 = this._graphs, g2 = other._graphs;
        let s1, s2, p1, p2, o1;
        for (const graph in g2) {
          if (!(s1 = g1[graph])) return false;
          s1 = s1.subjects;
          for (const subject in s2 = g2[graph].subjects) {
            if (!(p1 = s1[subject])) return false;
            for (const predicate in p2 = s2[subject]) {
              if (!(o1 = p1[predicate])) return false;
              for (const object in p2[predicate]) if (!(object in o1)) return false;
            }
          }
        }
        return true;
      }
      /**
       * This method removes the quads in the current dataset that match the given arguments.
       *
       * The logic described in {@link https://rdf.js.org/dataset-spec/#quad-matching|Quad Matching} is applied for each
       * quad in this dataset, to select the quads which will be deleted.
       *
       * @param subject   The optional exact subject to match.
       * @param predicate The optional exact predicate to match.
       * @param object    The optional exact object to match.
       * @param graph     The optional exact graph to match.
       */
      deleteMatches(subject, predicate, object, graph) {
        for (const quad2 of this.match(subject, predicate, object, graph)) this.removeQuad(quad2);
        return this;
      }
      /**
       * Returns a new dataset that contains all quads from the current dataset that are not included in the given dataset.
       */
      difference(other) {
        if (other && other instanceof DatasetCoreAndReadableStream) other = other.filtered;
        if (other === this) return new _N3Store({
          entityIndex: this._entityIndex
        });
        if (other instanceof _N3Store && other._entityIndex === this._entityIndex) {
          const store = new _N3Store({
            entityIndex: this._entityIndex
          });
          const graphs = difference(this._graphs, other._graphs);
          if (graphs) {
            store._graphs = graphs;
            store._size = null;
          }
          return store;
        }
        return this.filter((quad2) => !other.has(quad2));
      }
      /**
       * Returns true if the current dataset contains the same graph structure as the given dataset.
       *
       * Blank Nodes will be normalized.
       */
      equals(other) {
        if (other instanceof DatasetCoreAndReadableStream) other = other.filtered;
        return other === this || this.size === other.size && this.contains(other);
      }
      /**
       * Creates a new dataset with all the quads that pass the test implemented by the provided `iteratee`.
       *
       * This method is aligned with Array.prototype.filter() in ECMAScript-262.
       */
      filter(iteratee) {
        const store = new _N3Store({
          entityIndex: this._entityIndex
        });
        for (const quad2 of this) if (iteratee(quad2, this)) store.add(quad2);
        return store;
      }
      /**
       * Returns a new dataset containing all quads from the current dataset that are also included in the given dataset.
       */
      intersection(other) {
        if (other instanceof DatasetCoreAndReadableStream) other = other.filtered;
        if (other === this) {
          const store = new _N3Store({
            entityIndex: this._entityIndex
          });
          store._graphs = merge(/* @__PURE__ */ Object.create(null), this._graphs);
          store._size = this._size;
          return store;
        } else if (other instanceof _N3Store && this._entityIndex === other._entityIndex) {
          const store = new _N3Store({
            entityIndex: this._entityIndex
          });
          const graphs = intersect(other._graphs, this._graphs);
          if (graphs) {
            store._graphs = graphs;
            store._size = null;
          }
          return store;
        }
        return this.filter((quad2) => other.has(quad2));
      }
      /**
       * Returns a new dataset containing all quads returned by applying `iteratee` to each quad in the current dataset.
       */
      map(iteratee) {
        const store = new _N3Store({
          entityIndex: this._entityIndex
        });
        for (const quad2 of this) store.add(iteratee(quad2, this));
        return store;
      }
      /**
       * This method calls the `iteratee` method on each `quad` of the `Dataset`. The first time the `iteratee` method
       * is called, the `accumulator` value is the `initialValue`, or, if not given, equals the first quad of the `Dataset`.
       * The return value of each call to the `iteratee` method is used as the `accumulator` value for the next call.
       *
       * This method returns the return value of the last `iteratee` call.
       *
       * This method is aligned with `Array.prototype.reduce()` in ECMAScript-262.
       */
      reduce(callback, initialValue) {
        const iter = this.readQuads();
        let accumulator = initialValue === void 0 ? iter.next().value : initialValue;
        for (const quad2 of iter) accumulator = callback(accumulator, quad2, this);
        return accumulator;
      }
      /**
       * Returns the set of quads within the dataset as a host-language-native sequence, for example an `Array` in
       * ECMAScript-262.
       *
       * Since a `Dataset` is an unordered set, the order of the quads within the returned sequence is arbitrary.
       */
      toArray() {
        return this.getQuads();
      }
      /**
       * Returns an N-Quads string representation of the dataset, preprocessed with the
       * {@link https://json-ld.github.io/normalization/spec/|RDF Dataset Normalization} algorithm.
       */
      toCanonical() {
        throw new Error("not implemented");
      }
      /**
       * Returns a stream that contains all quads of the dataset.
       */
      toStream() {
        return this.match();
      }
      /**
       * Returns an N-Quads string representation of the dataset.
       *
       * No prior normalization is required, therefore the results for the same quads may vary depending on the `Dataset`
       * implementation.
       */
      toString() {
        return new _N3Writer.default().quadsToString(this);
      }
      /**
       * Returns a new `Dataset` that is a concatenation of this dataset and the quads given as an argument.
       */
      union(quads) {
        const store = new _N3Store({
          entityIndex: this._entityIndex
        });
        store._graphs = merge(/* @__PURE__ */ Object.create(null), this._graphs);
        store._size = this._size;
        store.addAll(quads);
        return store;
      }
      // ### Store is an iterable.
      // Can be used where iterables are expected: for...of loops, array spread operator,
      // `yield*`, and destructuring assignment (order is not guaranteed).
      *[Symbol.iterator]() {
        yield* this.readQuads();
      }
    };
    exports.default = N3Store;
    function indexMatch(index, ids, depth = 0) {
      const ind = ids[depth];
      if (ind && !(ind in index)) return false;
      let target = false;
      for (const key in ind ? {
        [ind]: index[ind]
      } : index) {
        const result = depth === 2 ? null : indexMatch(index[key], ids, depth + 1);
        if (result !== false) {
          target = target || /* @__PURE__ */ Object.create(null);
          target[key] = result;
        }
      }
      return target;
    }
    var DatasetCoreAndReadableStream = class _DatasetCoreAndReadableStream extends _readableStream.Readable {
      constructor(n3Store, subject, predicate, object, graph, options) {
        super({
          objectMode: true
        });
        Object.assign(this, {
          n3Store,
          subject,
          predicate,
          object,
          graph,
          options
        });
      }
      get filtered() {
        if (!this._filtered) {
          const {
            n3Store,
            graph,
            object,
            predicate,
            subject
          } = this;
          const newStore = this._filtered = new N3Store({
            factory: n3Store._factory,
            entityIndex: this.options.entityIndex
          });
          let subjectId, predicateId, objectId;
          if (subject && !(subjectId = newStore._termToNumericId(subject)) || predicate && !(predicateId = newStore._termToNumericId(predicate)) || object && !(objectId = newStore._termToNumericId(object))) return newStore;
          const graphs = n3Store._getGraphs(graph);
          for (const graphKey in graphs) {
            let subjects, predicates, objects, content;
            if (content = graphs[graphKey]) {
              if (!subjectId && predicateId) {
                if (predicates = indexMatch(content.predicates, [predicateId, objectId, subjectId])) {
                  subjects = indexMatch(content.subjects, [subjectId, predicateId, objectId]);
                  objects = indexMatch(content.objects, [objectId, subjectId, predicateId]);
                }
              } else if (objectId) {
                if (objects = indexMatch(content.objects, [objectId, subjectId, predicateId])) {
                  subjects = indexMatch(content.subjects, [subjectId, predicateId, objectId]);
                  predicates = indexMatch(content.predicates, [predicateId, objectId, subjectId]);
                }
              } else if (subjects = indexMatch(content.subjects, [subjectId, predicateId, objectId])) {
                predicates = indexMatch(content.predicates, [predicateId, objectId, subjectId]);
                objects = indexMatch(content.objects, [objectId, subjectId, predicateId]);
              }
              if (subjects) newStore._graphs[graphKey] = {
                subjects,
                predicates,
                objects
              };
            }
          }
          newStore._size = null;
        }
        return this._filtered;
      }
      get size() {
        return this.filtered.size;
      }
      _read(size) {
        if (size > 0 && !this[ITERATOR]) this[ITERATOR] = this[Symbol.iterator]();
        const iterable = this[ITERATOR];
        while (--size >= 0) {
          const {
            done,
            value
          } = iterable.next();
          if (done) {
            this.push(null);
            return;
          }
          this.push(value);
        }
      }
      addAll(quads) {
        return this.filtered.addAll(quads);
      }
      contains(other) {
        return this.filtered.contains(other);
      }
      deleteMatches(subject, predicate, object, graph) {
        return this.filtered.deleteMatches(subject, predicate, object, graph);
      }
      difference(other) {
        return this.filtered.difference(other);
      }
      equals(other) {
        return this.filtered.equals(other);
      }
      every(callback, subject, predicate, object, graph) {
        return this.filtered.every(callback, subject, predicate, object, graph);
      }
      filter(iteratee) {
        return this.filtered.filter(iteratee);
      }
      forEach(callback, subject, predicate, object, graph) {
        return this.filtered.forEach(callback, subject, predicate, object, graph);
      }
      import(stream) {
        return this.filtered.import(stream);
      }
      intersection(other) {
        return this.filtered.intersection(other);
      }
      map(iteratee) {
        return this.filtered.map(iteratee);
      }
      some(callback, subject, predicate, object, graph) {
        return this.filtered.some(callback, subject, predicate, object, graph);
      }
      toCanonical() {
        return this.filtered.toCanonical();
      }
      toStream() {
        return this._filtered ? this._filtered.toStream() : this.n3Store.match(this.subject, this.predicate, this.object, this.graph);
      }
      union(quads) {
        return this._filtered ? this._filtered.union(quads) : this.n3Store.match(this.subject, this.predicate, this.object, this.graph).addAll(quads);
      }
      toArray() {
        return this._filtered ? this._filtered.toArray() : this.n3Store.getQuads(this.subject, this.predicate, this.object, this.graph);
      }
      reduce(callback, initialValue) {
        return this.filtered.reduce(callback, initialValue);
      }
      toString() {
        return new _N3Writer.default().quadsToString(this);
      }
      add(quad2) {
        return this.filtered.add(quad2);
      }
      delete(quad2) {
        return this.filtered.delete(quad2);
      }
      has(quad2) {
        return this.filtered.has(quad2);
      }
      match(subject, predicate, object, graph) {
        return new _DatasetCoreAndReadableStream(this.filtered, subject, predicate, object, graph, this.options);
      }
      *[Symbol.iterator]() {
        yield* this._filtered || this.n3Store.readQuads(this.subject, this.predicate, this.object, this.graph);
      }
    };
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3StoreFactory.js
var require_N3StoreFactory = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3StoreFactory.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _N3Store = _interopRequireDefault(require_N3Store());
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : { default: e };
    }
    var N3DatasetCoreFactory = class {
      dataset(quads) {
        return new _N3Store.default(quads);
      }
    };
    exports.default = N3DatasetCoreFactory;
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Reasoner.js
var require_N3Reasoner = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3Reasoner.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    exports.getRulesFromDataset = getRulesFromDataset;
    var _N3DataFactory = _interopRequireDefault(require_N3DataFactory());
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : { default: e };
    }
    function getRulesFromDataset(dataset2) {
      const rules = [];
      for (const {
        subject,
        object
      } of dataset2.match(null, _N3DataFactory.default.namedNode("http://www.w3.org/2000/10/swap/log#implies"), null, _N3DataFactory.default.defaultGraph())) {
        const premise = [...dataset2.match(null, null, null, subject)];
        const conclusion = [...dataset2.match(null, null, null, object)];
        rules.push({
          premise,
          conclusion
        });
      }
      return rules;
    }
    var N3Reasoner = class {
      constructor(store) {
        this._store = store;
      }
      _add(subject, predicate, object, graphItem, cb) {
        if (!this._store._addToIndex(graphItem.subjects, subject, predicate, object)) return;
        this._store._addToIndex(graphItem.predicates, predicate, object, subject);
        this._store._addToIndex(graphItem.objects, object, subject, predicate);
        cb();
      }
      // eslint-disable-next-line no-warning-comments
      _evaluatePremise(rule, content, cb, i = 0) {
        let v1, v2, value, index1, index2;
        const [val0, val1, val2] = rule.premise[i].value, index = content[rule.premise[i].content];
        const v0 = !(value = val0.value);
        for (value in v0 ? index : {
          [value]: index[value]
        }) {
          if (index1 = index[value]) {
            if (v0) val0.value = Number(value);
            v1 = !(value = val1.value);
            for (value in v1 ? index1 : {
              [value]: index1[value]
            }) {
              if (index2 = index1[value]) {
                if (v1) val1.value = Number(value);
                v2 = !(value = val2.value);
                for (value in v2 ? index2 : {
                  [value]: index2[value]
                }) {
                  if (v2) val2.value = Number(value);
                  if (i === rule.premise.length - 1) rule.conclusion.forEach((c) => {
                    this._add(c.subject.value, c.predicate.value, c.object.value, content, () => {
                      cb(c);
                    });
                  });
                  else this._evaluatePremise(rule, content, cb, i + 1);
                }
                if (v2) val2.value = null;
              }
            }
            if (v1) val1.value = null;
          }
        }
        if (v0) val0.value = null;
      }
      _evaluateRules(rules, content, cb) {
        for (let i = 0; i < rules.length; i++) {
          this._evaluatePremise(rules[i], content, cb);
        }
      }
      // A naive reasoning algorithm where rules are just applied by repeatedly applying rules
      // until no more evaluations are made
      _reasonGraphNaive(rules, content) {
        const newRules = [];
        function addRule(conclusion) {
          if (conclusion.next) conclusion.next.forEach((rule) => {
            newRules.push([conclusion.subject.value, conclusion.predicate.value, conclusion.object.value, rule]);
          });
        }
        const addConclusions = (conclusion) => {
          conclusion.forEach((c) => {
            this._add(c.subject.value, c.predicate.value, c.object.value, content, () => {
              addRule(c);
            });
          });
        };
        this._evaluateRules(rules, content, addRule);
        let r;
        while ((r = newRules.pop()) !== void 0) {
          const [subject, predicate, object, rule] = r;
          const v1 = rule.basePremise.subject.value;
          if (!v1) rule.basePremise.subject.value = subject;
          const v2 = rule.basePremise.predicate.value;
          if (!v2) rule.basePremise.predicate.value = predicate;
          const v3 = rule.basePremise.object.value;
          if (!v3) rule.basePremise.object.value = object;
          if (rule.premise.length === 0) {
            addConclusions(rule.conclusion);
          } else {
            this._evaluatePremise(rule, content, addRule);
          }
          if (!v1) rule.basePremise.subject.value = null;
          if (!v2) rule.basePremise.predicate.value = null;
          if (!v3) rule.basePremise.object.value = null;
        }
      }
      _createRule({
        premise,
        conclusion
      }) {
        const varMapping = {};
        const toId = (value) => value.termType === "Variable" ? (
          // If the term is a variable, then create an empty object that values can be placed into
          varMapping[value.value] = varMapping[value.value] || {}
        ) : (
          // If the term is not a variable, then set the ID value
          {
            value: this._store._termToNewNumericId(value)
          }
        );
        const t = (term2) => ({
          subject: toId(term2.subject),
          predicate: toId(term2.predicate),
          object: toId(term2.object)
        });
        return {
          premise: premise.map((p) => t(p)),
          conclusion: conclusion.map((p) => t(p)),
          variables: Object.values(varMapping)
        };
      }
      reason(rules) {
        if (!Array.isArray(rules)) {
          rules = getRulesFromDataset(rules);
        }
        rules = rules.map((rule) => this._createRule(rule));
        for (const r1 of rules) {
          for (const r2 of rules) {
            for (let i = 0; i < r2.premise.length; i++) {
              const p = r2.premise[i];
              for (const c of r1.conclusion) {
                if (termEq(p.subject, c.subject) && termEq(p.predicate, c.predicate) && termEq(p.object, c.object)) {
                  const set = /* @__PURE__ */ new Set();
                  const premise = [];
                  p.subject.value = p.subject.value || 1;
                  p.object.value = p.object.value || 1;
                  p.predicate.value = p.predicate.value || 1;
                  for (let j = 0; j < r2.premise.length; j++) {
                    if (j !== i) {
                      premise.push(getIndex(r2.premise[j], set));
                    }
                  }
                  (c.next = c.next || []).push({
                    premise,
                    conclusion: r2.conclusion,
                    // This is a single premise of the form { subject, predicate, object },
                    // which we can use to instantiate the rule using the new data that was emitted
                    basePremise: p
                  });
                }
                r2.variables.forEach((v) => {
                  v.value = null;
                });
              }
            }
          }
        }
        for (const rule of rules) {
          const set = /* @__PURE__ */ new Set();
          rule.premise = rule.premise.map((p) => getIndex(p, set));
        }
        const graphs = this._store._getGraphs();
        for (const graphId in graphs) {
          this._reasonGraphNaive(rules, graphs[graphId]);
        }
        this._store._size = null;
      }
    };
    exports.default = N3Reasoner;
    function getIndex({
      subject,
      predicate,
      object
    }, set) {
      const s = subject.value || set.has(subject) || (set.add(subject), false);
      const p = predicate.value || set.has(predicate) || (set.add(predicate), false);
      const o = object.value || set.has(object) || (set.add(object), false);
      return !s && p ? {
        content: "predicates",
        value: [predicate, object, subject]
      } : o ? {
        content: "objects",
        value: [object, subject, predicate]
      } : {
        content: "subjects",
        value: [subject, predicate, object]
      };
    }
    function termEq(t1, t2) {
      if (t1.value === null) {
        t1.value = t2.value;
      }
      return t1.value === t2.value;
    }
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3StreamParser.js
var require_N3StreamParser = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3StreamParser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _readableStream = require_ours();
    var _N3Parser = _interopRequireDefault(require_N3Parser());
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : { default: e };
    }
    var N3StreamParser = class extends _readableStream.Transform {
      constructor(options) {
        super({
          decodeStrings: true
        });
        this._readableState.objectMode = true;
        const parser = new _N3Parser.default(options);
        let onData, onEnd;
        const callbacks = {
          // Handle quads by pushing them down the pipeline
          onQuad: (error2, quad2) => {
            error2 && this.emit("error", error2) || quad2 && this.push(quad2);
          },
          // Emit prefixes through the `prefix` event
          onPrefix: (prefix, uri) => {
            this.emit("prefix", prefix, uri);
          }
        };
        if (options && options.comments) callbacks.onComment = (comment) => {
          this.emit("comment", comment);
        };
        parser.parse({
          on: (event, callback) => {
            switch (event) {
              case "data":
                onData = callback;
                break;
              case "end":
                onEnd = callback;
                break;
            }
          }
        }, callbacks);
        this._transform = (chunk, encoding, done) => {
          onData(chunk);
          done();
        };
        this._flush = (done) => {
          onEnd();
          done();
        };
      }
      // ### Parses a stream of strings
      import(stream) {
        stream.on("data", (chunk) => {
          this.write(chunk);
        });
        stream.on("end", () => {
          this.end();
        });
        stream.on("error", (error2) => {
          this.emit("error", error2);
        });
        return this;
      }
    };
    exports.default = N3StreamParser;
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3StreamWriter.js
var require_N3StreamWriter = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/N3StreamWriter.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _readableStream = require_ours();
    var _N3Writer = _interopRequireDefault(require_N3Writer());
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : { default: e };
    }
    var N3StreamWriter = class extends _readableStream.Transform {
      constructor(options) {
        super({
          encoding: "utf8",
          writableObjectMode: true
        });
        const writer = this._writer = new _N3Writer.default({
          write: (quad2, encoding, callback) => {
            this.push(quad2);
            callback && callback();
          },
          end: (callback) => {
            this.push(null);
            callback && callback();
          }
        }, options);
        this._transform = (quad2, encoding, done) => {
          writer.addQuad(quad2, done);
        };
        this._flush = (done) => {
          writer.end(done);
        };
      }
      // ### Serializes a stream of quads
      import(stream) {
        stream.on("data", (quad2) => {
          this.write(quad2);
        });
        stream.on("end", () => {
          this.end();
        });
        stream.on("error", (error2) => {
          this.emit("error", error2);
        });
        stream.on("prefix", (prefix, iri) => {
          this._writer.addPrefix(prefix, iri);
        });
        return this;
      }
    };
    exports.default = N3StreamWriter;
  }
});

// ../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/index.js
var require_lib = __commonJS({
  "../../node_modules/.pnpm/n3@1.26.0/node_modules/n3/lib/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "BaseIRI", {
      enumerable: true,
      get: function() {
        return _BaseIRI.default;
      }
    });
    Object.defineProperty(exports, "BlankNode", {
      enumerable: true,
      get: function() {
        return _N3DataFactory.BlankNode;
      }
    });
    Object.defineProperty(exports, "DataFactory", {
      enumerable: true,
      get: function() {
        return _N3DataFactory.default;
      }
    });
    Object.defineProperty(exports, "DefaultGraph", {
      enumerable: true,
      get: function() {
        return _N3DataFactory.DefaultGraph;
      }
    });
    Object.defineProperty(exports, "EntityIndex", {
      enumerable: true,
      get: function() {
        return _N3Store.N3EntityIndex;
      }
    });
    Object.defineProperty(exports, "Lexer", {
      enumerable: true,
      get: function() {
        return _N3Lexer.default;
      }
    });
    Object.defineProperty(exports, "Literal", {
      enumerable: true,
      get: function() {
        return _N3DataFactory.Literal;
      }
    });
    Object.defineProperty(exports, "NamedNode", {
      enumerable: true,
      get: function() {
        return _N3DataFactory.NamedNode;
      }
    });
    Object.defineProperty(exports, "Parser", {
      enumerable: true,
      get: function() {
        return _N3Parser.default;
      }
    });
    Object.defineProperty(exports, "Quad", {
      enumerable: true,
      get: function() {
        return _N3DataFactory.Quad;
      }
    });
    Object.defineProperty(exports, "Reasoner", {
      enumerable: true,
      get: function() {
        return _N3Reasoner.default;
      }
    });
    Object.defineProperty(exports, "Store", {
      enumerable: true,
      get: function() {
        return _N3Store.default;
      }
    });
    Object.defineProperty(exports, "StoreFactory", {
      enumerable: true,
      get: function() {
        return _N3StoreFactory.default;
      }
    });
    Object.defineProperty(exports, "StreamParser", {
      enumerable: true,
      get: function() {
        return _N3StreamParser.default;
      }
    });
    Object.defineProperty(exports, "StreamWriter", {
      enumerable: true,
      get: function() {
        return _N3StreamWriter.default;
      }
    });
    Object.defineProperty(exports, "Term", {
      enumerable: true,
      get: function() {
        return _N3DataFactory.Term;
      }
    });
    Object.defineProperty(exports, "Triple", {
      enumerable: true,
      get: function() {
        return _N3DataFactory.Triple;
      }
    });
    exports.Util = void 0;
    Object.defineProperty(exports, "Variable", {
      enumerable: true,
      get: function() {
        return _N3DataFactory.Variable;
      }
    });
    Object.defineProperty(exports, "Writer", {
      enumerable: true,
      get: function() {
        return _N3Writer.default;
      }
    });
    exports.default = void 0;
    Object.defineProperty(exports, "getRulesFromDataset", {
      enumerable: true,
      get: function() {
        return _N3Reasoner.getRulesFromDataset;
      }
    });
    Object.defineProperty(exports, "termFromId", {
      enumerable: true,
      get: function() {
        return _N3DataFactory.termFromId;
      }
    });
    Object.defineProperty(exports, "termToId", {
      enumerable: true,
      get: function() {
        return _N3DataFactory.termToId;
      }
    });
    var _N3Lexer = _interopRequireDefault(require_N3Lexer());
    var _N3Parser = _interopRequireDefault(require_N3Parser());
    var _N3Writer = _interopRequireDefault(require_N3Writer());
    var _N3Store = _interopRequireWildcard(require_N3Store());
    var _N3StoreFactory = _interopRequireDefault(require_N3StoreFactory());
    var _N3Reasoner = _interopRequireWildcard(require_N3Reasoner());
    var _N3StreamParser = _interopRequireDefault(require_N3StreamParser());
    var _N3StreamWriter = _interopRequireDefault(require_N3StreamWriter());
    var Util = _interopRequireWildcard(require_N3Util());
    exports.Util = Util;
    var _BaseIRI = _interopRequireDefault(require_BaseIRI());
    var _N3DataFactory = _interopRequireWildcard(require_N3DataFactory());
    function _interopRequireWildcard(e, t) {
      if ("function" == typeof WeakMap) var r = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap();
      return (_interopRequireWildcard = function(e2, t2) {
        if (!t2 && e2 && e2.__esModule) return e2;
        var o, i, f = { __proto__: null, default: e2 };
        if (null === e2 || "object" != typeof e2 && "function" != typeof e2) return f;
        if (o = t2 ? n : r) {
          if (o.has(e2)) return o.get(e2);
          o.set(e2, f);
        }
        for (const t3 in e2) "default" !== t3 && {}.hasOwnProperty.call(e2, t3) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e2, t3)) && (i.get || i.set) ? o(f, t3, i) : f[t3] = e2[t3]);
        return f;
      })(e, t);
    }
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : { default: e };
    }
    var _default = exports.default = {
      Lexer: _N3Lexer.default,
      Parser: _N3Parser.default,
      Writer: _N3Writer.default,
      Store: _N3Store.default,
      StoreFactory: _N3StoreFactory.default,
      EntityIndex: _N3Store.N3EntityIndex,
      StreamParser: _N3StreamParser.default,
      StreamWriter: _N3StreamWriter.default,
      Util,
      Reasoner: _N3Reasoner.default,
      BaseIRI: _BaseIRI.default,
      DataFactory: _N3DataFactory.default,
      Term: _N3DataFactory.Term,
      NamedNode: _N3DataFactory.NamedNode,
      Literal: _N3DataFactory.Literal,
      BlankNode: _N3DataFactory.BlankNode,
      Variable: _N3DataFactory.Variable,
      DefaultGraph: _N3DataFactory.DefaultGraph,
      Quad: _N3DataFactory.Quad,
      Triple: _N3DataFactory.Triple,
      termFromId: _N3DataFactory.termFromId,
      termToId: _N3DataFactory.termToId
    };
  }
});

// ../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/BlankNode.js
var require_BlankNode = __commonJS({
  "../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/BlankNode.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BlankNode = void 0;
    var BlankNode2 = class {
      constructor(value) {
        this.termType = "BlankNode";
        this.value = value;
      }
      equals(other) {
        return !!other && other.termType === "BlankNode" && other.value === this.value;
      }
    };
    exports.BlankNode = BlankNode2;
  }
});

// ../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/DefaultGraph.js
var require_DefaultGraph = __commonJS({
  "../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/DefaultGraph.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DefaultGraph = void 0;
    var DefaultGraph2 = class {
      constructor() {
        this.termType = "DefaultGraph";
        this.value = "";
      }
      equals(other) {
        return !!other && other.termType === "DefaultGraph";
      }
    };
    exports.DefaultGraph = DefaultGraph2;
    DefaultGraph2.INSTANCE = new DefaultGraph2();
  }
});

// ../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/NamedNode.js
var require_NamedNode = __commonJS({
  "../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/NamedNode.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NamedNode = void 0;
    var NamedNode2 = class {
      constructor(value) {
        this.termType = "NamedNode";
        this.value = value;
      }
      equals(other) {
        return !!other && other.termType === "NamedNode" && other.value === this.value;
      }
    };
    exports.NamedNode = NamedNode2;
  }
});

// ../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/Literal.js
var require_Literal = __commonJS({
  "../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/Literal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Literal = void 0;
    var NamedNode_1 = require_NamedNode();
    var Literal2 = class _Literal {
      constructor(value, languageOrDatatype) {
        this.termType = "Literal";
        this.value = value;
        if (typeof languageOrDatatype === "string") {
          this.language = languageOrDatatype;
          this.datatype = _Literal.RDF_LANGUAGE_STRING;
        } else if (languageOrDatatype) {
          this.language = "";
          this.datatype = languageOrDatatype;
        } else {
          this.language = "";
          this.datatype = _Literal.XSD_STRING;
        }
      }
      equals(other) {
        return !!other && other.termType === "Literal" && other.value === this.value && other.language === this.language && this.datatype.equals(other.datatype);
      }
    };
    exports.Literal = Literal2;
    Literal2.RDF_LANGUAGE_STRING = new NamedNode_1.NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#langString");
    Literal2.XSD_STRING = new NamedNode_1.NamedNode("http://www.w3.org/2001/XMLSchema#string");
  }
});

// ../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/Quad.js
var require_Quad = __commonJS({
  "../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/Quad.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Quad = void 0;
    var Quad2 = class {
      constructor(subject, predicate, object, graph) {
        this.termType = "Quad";
        this.value = "";
        this.subject = subject;
        this.predicate = predicate;
        this.object = object;
        this.graph = graph;
      }
      equals(other) {
        return !!other && (other.termType === "Quad" || !other.termType) && this.subject.equals(other.subject) && this.predicate.equals(other.predicate) && this.object.equals(other.object) && this.graph.equals(other.graph);
      }
    };
    exports.Quad = Quad2;
  }
});

// ../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/Variable.js
var require_Variable = __commonJS({
  "../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/Variable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Variable = void 0;
    var Variable2 = class {
      constructor(value) {
        this.termType = "Variable";
        this.value = value;
      }
      equals(other) {
        return !!other && other.termType === "Variable" && other.value === this.value;
      }
    };
    exports.Variable = Variable2;
  }
});

// ../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/DataFactory.js
var require_DataFactory = __commonJS({
  "../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/lib/DataFactory.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DataFactory = void 0;
    var BlankNode_1 = require_BlankNode();
    var DefaultGraph_1 = require_DefaultGraph();
    var Literal_1 = require_Literal();
    var NamedNode_1 = require_NamedNode();
    var Quad_1 = require_Quad();
    var Variable_1 = require_Variable();
    var dataFactoryCounter = 0;
    var DataFactory2 = class {
      constructor(options) {
        this.blankNodeCounter = 0;
        options = options || {};
        this.blankNodePrefix = options.blankNodePrefix || `df_${dataFactoryCounter++}_`;
      }
      /**
       * @param value The IRI for the named node.
       * @return A new instance of NamedNode.
       * @see NamedNode
       */
      namedNode(value) {
        return new NamedNode_1.NamedNode(value);
      }
      /**
       * @param value The optional blank node identifier.
       * @return A new instance of BlankNode.
       *         If the `value` parameter is undefined a new identifier
       *         for the blank node is generated for each call.
       * @see BlankNode
       */
      blankNode(value) {
        return new BlankNode_1.BlankNode(value || `${this.blankNodePrefix}${this.blankNodeCounter++}`);
      }
      /**
       * @param value              The literal value.
       * @param languageOrDatatype The optional language or datatype.
       *                           If `languageOrDatatype` is a NamedNode,
       *                           then it is used for the value of `NamedNode.datatype`.
       *                           Otherwise `languageOrDatatype` is used for the value
       *                           of `NamedNode.language`.
       * @return A new instance of Literal.
       * @see Literal
       */
      literal(value, languageOrDatatype) {
        return new Literal_1.Literal(value, languageOrDatatype);
      }
      /**
       * This method is optional.
       * @param value The variable name
       * @return A new instance of Variable.
       * @see Variable
       */
      variable(value) {
        return new Variable_1.Variable(value);
      }
      /**
       * @return An instance of DefaultGraph.
       */
      defaultGraph() {
        return DefaultGraph_1.DefaultGraph.INSTANCE;
      }
      /**
       * @param subject   The quad subject term.
       * @param predicate The quad predicate term.
       * @param object    The quad object term.
       * @param graph     The quad graph term.
       * @return A new instance of Quad.
       * @see Quad
       */
      quad(subject, predicate, object, graph) {
        return new Quad_1.Quad(subject, predicate, object, graph || this.defaultGraph());
      }
      /**
       * Create a deep copy of the given term using this data factory.
       * @param original An RDF term.
       * @return A deep copy of the given term.
       */
      fromTerm(original) {
        switch (original.termType) {
          case "NamedNode":
            return this.namedNode(original.value);
          case "BlankNode":
            return this.blankNode(original.value);
          case "Literal":
            if (original.language) {
              return this.literal(original.value, original.language);
            }
            if (!original.datatype.equals(Literal_1.Literal.XSD_STRING)) {
              return this.literal(original.value, this.fromTerm(original.datatype));
            }
            return this.literal(original.value);
          case "Variable":
            return this.variable(original.value);
          case "DefaultGraph":
            return this.defaultGraph();
          case "Quad":
            return this.quad(this.fromTerm(original.subject), this.fromTerm(original.predicate), this.fromTerm(original.object), this.fromTerm(original.graph));
        }
      }
      /**
       * Create a deep copy of the given quad using this data factory.
       * @param original An RDF quad.
       * @return A deep copy of the given quad.
       */
      fromQuad(original) {
        return this.fromTerm(original);
      }
      /**
       * Reset the internal blank node counter.
       */
      resetBlankNodeCounter() {
        this.blankNodeCounter = 0;
      }
    };
    exports.DataFactory = DataFactory2;
  }
});

// ../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/index.js
var require_rdf_data_factory = __commonJS({
  "../../node_modules/.pnpm/rdf-data-factory@1.1.3/node_modules/rdf-data-factory/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_BlankNode(), exports);
    __exportStar(require_DataFactory(), exports);
    __exportStar(require_DefaultGraph(), exports);
    __exportStar(require_Literal(), exports);
    __exportStar(require_NamedNode(), exports);
    __exportStar(require_Quad(), exports);
    __exportStar(require_Variable(), exports);
  }
});

// ../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/Translator.js
var require_Translator = __commonJS({
  "../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/Translator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Translator = void 0;
    var Translator = class {
      constructor() {
        this.supportedRdfDatatypes = [];
        this.fromRdfHandlers = {};
        this.toRdfHandlers = {};
      }
      static incorrectRdfDataType(literal3) {
        throw new Error(`Invalid RDF ${literal3.datatype.value} value: '${literal3.value}'`);
      }
      registerHandler(handler2, rdfDatatypes, javaScriptDataTypes) {
        for (const rdfDatatype of rdfDatatypes) {
          this.supportedRdfDatatypes.push(rdfDatatype);
          this.fromRdfHandlers[rdfDatatype.value] = handler2;
        }
        for (const javaScriptDataType of javaScriptDataTypes) {
          let existingToRdfHandlers = this.toRdfHandlers[javaScriptDataType];
          if (!existingToRdfHandlers) {
            this.toRdfHandlers[javaScriptDataType] = existingToRdfHandlers = [];
          }
          existingToRdfHandlers.push(handler2);
        }
      }
      fromRdf(literal3, validate) {
        const handler2 = this.fromRdfHandlers[literal3.datatype.value];
        if (handler2) {
          return handler2.fromRdf(literal3, validate);
        } else {
          return literal3.value;
        }
      }
      toRdf(value, options) {
        const handlers = this.toRdfHandlers[typeof value];
        if (handlers) {
          for (const handler2 of handlers) {
            const ret = handler2.toRdf(value, options);
            if (ret) {
              return ret;
            }
          }
        }
        throw new Error(`Invalid JavaScript value: '${value}'`);
      }
      /**
       * @return {NamedNode[]} An array of all supported RDF datatypes.
       */
      getSupportedRdfDatatypes() {
        return this.supportedRdfDatatypes;
      }
      /**
       * @return {string[]} An array of all supported JavaScript types.
       */
      getSupportedJavaScriptPrimitives() {
        return Object.keys(this.toRdfHandlers);
      }
    };
    exports.Translator = Translator;
  }
});

// ../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/TypeHandlerBoolean.js
var require_TypeHandlerBoolean = __commonJS({
  "../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/TypeHandlerBoolean.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeHandlerBoolean = void 0;
    var Translator_1 = require_Translator();
    var TypeHandlerBoolean = class _TypeHandlerBoolean {
      fromRdf(literal3, validate) {
        switch (literal3.value) {
          case "true":
            return true;
          case "false":
            return false;
          case "1":
            return true;
          case "0":
            return false;
        }
        if (validate) {
          Translator_1.Translator.incorrectRdfDataType(literal3);
        }
        return false;
      }
      toRdf(value, { datatype, dataFactory }) {
        return dataFactory.literal(value ? "true" : "false", datatype || dataFactory.namedNode(_TypeHandlerBoolean.TYPE));
      }
    };
    TypeHandlerBoolean.TYPE = "http://www.w3.org/2001/XMLSchema#boolean";
    exports.TypeHandlerBoolean = TypeHandlerBoolean;
  }
});

// ../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/TypeHandlerDate.js
var require_TypeHandlerDate = __commonJS({
  "../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/TypeHandlerDate.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeHandlerDate = void 0;
    var Translator_1 = require_Translator();
    var TypeHandlerDate = class _TypeHandlerDate {
      fromRdf(literal3, validate) {
        if (validate && !literal3.value.match(_TypeHandlerDate.VALIDATORS[literal3.datatype.value.substr(33, literal3.datatype.value.length)])) {
          Translator_1.Translator.incorrectRdfDataType(literal3);
        }
        switch (literal3.datatype.value) {
          case "http://www.w3.org/2001/XMLSchema#gDay":
            return new Date(0, 0, parseInt(literal3.value, 10));
          case "http://www.w3.org/2001/XMLSchema#gMonthDay":
            const partsMonthDay = literal3.value.split("-");
            return new Date(0, parseInt(partsMonthDay[0], 10) - 1, parseInt(partsMonthDay[1], 10));
          case "http://www.w3.org/2001/XMLSchema#gYear":
            return /* @__PURE__ */ new Date(literal3.value + "-01-01");
          case "http://www.w3.org/2001/XMLSchema#gYearMonth":
            return /* @__PURE__ */ new Date(literal3.value + "-01");
          default:
            return new Date(literal3.value);
        }
      }
      toRdf(value, { datatype, dataFactory }) {
        datatype = datatype || dataFactory.namedNode(_TypeHandlerDate.TYPES[0]);
        if (!(value instanceof Date)) {
          return null;
        }
        const date = value;
        let valueString;
        switch (datatype.value) {
          case "http://www.w3.org/2001/XMLSchema#gDay":
            valueString = String(date.getUTCDate());
            break;
          case "http://www.w3.org/2001/XMLSchema#gMonthDay":
            valueString = date.getUTCMonth() + 1 + "-" + date.getUTCDate();
            break;
          case "http://www.w3.org/2001/XMLSchema#gYear":
            valueString = String(date.getUTCFullYear());
            break;
          case "http://www.w3.org/2001/XMLSchema#gYearMonth":
            valueString = date.getUTCFullYear() + "-" + (date.getUTCMonth() + 1);
            break;
          case "http://www.w3.org/2001/XMLSchema#date":
            valueString = date.toISOString().replace(/T.*$/, "");
            break;
          default:
            valueString = date.toISOString();
        }
        return dataFactory.literal(valueString, datatype);
      }
    };
    TypeHandlerDate.TYPES = [
      "http://www.w3.org/2001/XMLSchema#dateTime",
      "http://www.w3.org/2001/XMLSchema#date",
      "http://www.w3.org/2001/XMLSchema#gDay",
      "http://www.w3.org/2001/XMLSchema#gMonthDay",
      "http://www.w3.org/2001/XMLSchema#gYear",
      "http://www.w3.org/2001/XMLSchema#gYearMonth"
    ];
    TypeHandlerDate.VALIDATORS = {
      date: /^[0-9]+-[0-9][0-9]-[0-9][0-9]Z?$/,
      dateTime: /^[0-9]+-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9](\.[0-9][0-9][0-9])?((Z?)|([\+-][0-9][0-9]:[0-9][0-9]))$/,
      gDay: /^[0-9]+$/,
      gMonthDay: /^[0-9]+-[0-9][0-9]$/,
      gYear: /^[0-9]+$/,
      gYearMonth: /^[0-9]+-[0-9][0-9]$/
    };
    exports.TypeHandlerDate = TypeHandlerDate;
  }
});

// ../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/TypeHandlerNumberDouble.js
var require_TypeHandlerNumberDouble = __commonJS({
  "../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/TypeHandlerNumberDouble.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeHandlerNumberDouble = void 0;
    var Translator_1 = require_Translator();
    var TypeHandlerNumberDouble = class _TypeHandlerNumberDouble {
      fromRdf(literal3, validate) {
        const parsed = parseFloat(literal3.value);
        if (validate) {
          if (isNaN(parsed)) {
            Translator_1.Translator.incorrectRdfDataType(literal3);
          }
        }
        return parsed;
      }
      toRdf(value, { datatype, dataFactory }) {
        datatype = datatype || dataFactory.namedNode(_TypeHandlerNumberDouble.TYPES[0]);
        if (isNaN(value)) {
          return dataFactory.literal("NaN", datatype);
        }
        if (!isFinite(value)) {
          return dataFactory.literal(value > 0 ? "INF" : "-INF", datatype);
        }
        if (value % 1 === 0) {
          return null;
        }
        return dataFactory.literal(value.toExponential(15).replace(/(\d)0*e\+?/, "$1E"), datatype);
      }
    };
    TypeHandlerNumberDouble.TYPES = [
      "http://www.w3.org/2001/XMLSchema#double",
      "http://www.w3.org/2001/XMLSchema#decimal",
      "http://www.w3.org/2001/XMLSchema#float"
    ];
    exports.TypeHandlerNumberDouble = TypeHandlerNumberDouble;
  }
});

// ../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/TypeHandlerNumberInteger.js
var require_TypeHandlerNumberInteger = __commonJS({
  "../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/TypeHandlerNumberInteger.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeHandlerNumberInteger = void 0;
    var Translator_1 = require_Translator();
    var TypeHandlerNumberInteger = class _TypeHandlerNumberInteger {
      fromRdf(literal3, validate) {
        const parsed = parseInt(literal3.value, 10);
        if (validate) {
          if (isNaN(parsed) || literal3.value.indexOf(".") >= 0) {
            Translator_1.Translator.incorrectRdfDataType(literal3);
          }
        }
        return parsed;
      }
      toRdf(value, { datatype, dataFactory }) {
        return dataFactory.literal(String(value), datatype || (value <= _TypeHandlerNumberInteger.MAX_INT && value >= _TypeHandlerNumberInteger.MIN_INT ? dataFactory.namedNode(_TypeHandlerNumberInteger.TYPES[0]) : dataFactory.namedNode(_TypeHandlerNumberInteger.TYPES[1])));
      }
    };
    TypeHandlerNumberInteger.TYPES = [
      "http://www.w3.org/2001/XMLSchema#integer",
      "http://www.w3.org/2001/XMLSchema#long",
      "http://www.w3.org/2001/XMLSchema#int",
      "http://www.w3.org/2001/XMLSchema#byte",
      "http://www.w3.org/2001/XMLSchema#short",
      "http://www.w3.org/2001/XMLSchema#negativeInteger",
      "http://www.w3.org/2001/XMLSchema#nonNegativeInteger",
      "http://www.w3.org/2001/XMLSchema#nonPositiveInteger",
      "http://www.w3.org/2001/XMLSchema#positiveInteger",
      "http://www.w3.org/2001/XMLSchema#unsignedByte",
      "http://www.w3.org/2001/XMLSchema#unsignedInt",
      "http://www.w3.org/2001/XMLSchema#unsignedLong",
      "http://www.w3.org/2001/XMLSchema#unsignedShort"
    ];
    TypeHandlerNumberInteger.MAX_INT = 2147483647;
    TypeHandlerNumberInteger.MIN_INT = -2147483648;
    exports.TypeHandlerNumberInteger = TypeHandlerNumberInteger;
  }
});

// ../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/TypeHandlerString.js
var require_TypeHandlerString = __commonJS({
  "../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/TypeHandlerString.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeHandlerString = void 0;
    var TypeHandlerString = class {
      fromRdf(literal3) {
        return literal3.value;
      }
      toRdf(value, { datatype, dataFactory }) {
        return dataFactory.literal(value, datatype);
      }
    };
    TypeHandlerString.TYPES = [
      "http://www.w3.org/2001/XMLSchema#string",
      "http://www.w3.org/2001/XMLSchema#normalizedString",
      "http://www.w3.org/2001/XMLSchema#anyURI",
      "http://www.w3.org/2001/XMLSchema#base64Binary",
      "http://www.w3.org/2001/XMLSchema#language",
      "http://www.w3.org/2001/XMLSchema#Name",
      "http://www.w3.org/2001/XMLSchema#NCName",
      "http://www.w3.org/2001/XMLSchema#NMTOKEN",
      "http://www.w3.org/2001/XMLSchema#token",
      "http://www.w3.org/2001/XMLSchema#hexBinary",
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
      "http://www.w3.org/2001/XMLSchema#time",
      "http://www.w3.org/2001/XMLSchema#duration"
    ];
    exports.TypeHandlerString = TypeHandlerString;
  }
});

// ../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/index.js
var require_handler = __commonJS({
  "../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/handler/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_TypeHandlerBoolean(), exports);
    __exportStar(require_TypeHandlerDate(), exports);
    __exportStar(require_TypeHandlerNumberDouble(), exports);
    __exportStar(require_TypeHandlerNumberInteger(), exports);
    __exportStar(require_TypeHandlerString(), exports);
  }
});

// ../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/ITypeHandler.js
var require_ITypeHandler = __commonJS({
  "../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/lib/ITypeHandler.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// ../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/index.js
var require_rdf_literal = __commonJS({
  "../../node_modules/.pnpm/rdf-literal@1.3.2/node_modules/rdf-literal/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSupportedJavaScriptPrimitives = exports.getSupportedRdfDatatypes = exports.getTermRaw = exports.toRdf = exports.fromRdf = void 0;
    var rdf_data_factory_1 = require_rdf_data_factory();
    var handler_1 = require_handler();
    var Translator_1 = require_Translator();
    __exportStar(require_handler(), exports);
    __exportStar(require_ITypeHandler(), exports);
    __exportStar(require_Translator(), exports);
    var DF = new rdf_data_factory_1.DataFactory();
    var translator = new Translator_1.Translator();
    translator.registerHandler(new handler_1.TypeHandlerString(), handler_1.TypeHandlerString.TYPES.map((t) => DF.namedNode(t)), ["string"]);
    translator.registerHandler(new handler_1.TypeHandlerBoolean(), [handler_1.TypeHandlerBoolean.TYPE].map((t) => DF.namedNode(t)), ["boolean"]);
    translator.registerHandler(new handler_1.TypeHandlerNumberDouble(), handler_1.TypeHandlerNumberDouble.TYPES.map((t) => DF.namedNode(t)), ["number"]);
    translator.registerHandler(new handler_1.TypeHandlerNumberInteger(), handler_1.TypeHandlerNumberInteger.TYPES.map((t) => DF.namedNode(t)), ["number"]);
    translator.registerHandler(new handler_1.TypeHandlerDate(), handler_1.TypeHandlerDate.TYPES.map((t) => DF.namedNode(t)), ["object"]);
    function fromRdf2(literal3, validate) {
      return translator.fromRdf(literal3, validate);
    }
    exports.fromRdf = fromRdf2;
    function toRdf(value, options) {
      if (options && "namedNode" in options) {
        options = { dataFactory: options };
      }
      options = options || {};
      if (options && !options.dataFactory) {
        options.dataFactory = DF;
      }
      return translator.toRdf(value, options);
    }
    exports.toRdf = toRdf;
    function getTermRaw(term2, validate) {
      if (term2.termType === "Literal") {
        return fromRdf2(term2, validate);
      }
      return term2.value;
    }
    exports.getTermRaw = getTermRaw;
    function getSupportedRdfDatatypes() {
      return translator.getSupportedRdfDatatypes();
    }
    exports.getSupportedRdfDatatypes = getSupportedRdfDatatypes;
    function getSupportedJavaScriptPrimitives() {
      return translator.getSupportedJavaScriptPrimitives();
    }
    exports.getSupportedJavaScriptPrimitives = getSupportedJavaScriptPrimitives;
  }
});

// ../../node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js
var require_ms = __commonJS({
  "../../node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js"(exports, module) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// ../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/common.js
var require_common = __commonJS({
  "../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/common.js"(exports, module) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace2) {
        let hash = 0;
        for (let i = 0; i < namespace2.length; i++) {
          hash = (hash << 5) - hash + namespace2.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace2) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug2(...args) {
          if (!debug2.enabled) {
            return;
          }
          const self = debug2;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self, args);
          const logFn = self.log || createDebug.log;
          logFn.apply(self, args);
        }
        debug2.namespace = namespace2;
        debug2.useColors = createDebug.useColors();
        debug2.color = createDebug.selectColor(namespace2);
        debug2.extend = extend;
        debug2.destroy = createDebug.destroy;
        Object.defineProperty(debug2, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace2);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug2);
        }
        return debug2;
      }
      function extend(namespace2, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace2);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns2 of split) {
          if (ns2[0] === "-") {
            createDebug.skips.push(ns2.slice(1));
          } else {
            createDebug.names.push(ns2);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace2) => "-" + namespace2)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns2 of createDebug.names) {
          if (matchesTemplate(name, ns2)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module.exports = setup;
  }
});

// ../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/browser.js"(exports, module) {
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error2) {
      }
    }
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error2) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error2) {
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error2) {
        return "[UnexpectedJSONParseError]: " + error2.message;
      }
    };
  }
});

// ../../node_modules/.pnpm/has-flag@4.0.0/node_modules/has-flag/index.js
var require_has_flag = __commonJS({
  "../../node_modules/.pnpm/has-flag@4.0.0/node_modules/has-flag/index.js"(exports, module) {
    "use strict";
    module.exports = (flag, argv = process.argv) => {
      const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
      const position = argv.indexOf(prefix + flag);
      const terminatorPosition = argv.indexOf("--");
      return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
    };
  }
});

// ../../node_modules/.pnpm/supports-color@7.2.0/node_modules/supports-color/index.js
var require_supports_color = __commonJS({
  "../../node_modules/.pnpm/supports-color@7.2.0/node_modules/supports-color/index.js"(exports, module) {
    "use strict";
    var os = __require("os");
    var tty = __require("tty");
    var hasFlag2 = require_has_flag();
    var { env } = process;
    var forceColor;
    if (hasFlag2("no-color") || hasFlag2("no-colors") || hasFlag2("color=false") || hasFlag2("color=never")) {
      forceColor = 0;
    } else if (hasFlag2("color") || hasFlag2("colors") || hasFlag2("color=true") || hasFlag2("color=always")) {
      forceColor = 1;
    }
    if ("FORCE_COLOR" in env) {
      if (env.FORCE_COLOR === "true") {
        forceColor = 1;
      } else if (env.FORCE_COLOR === "false") {
        forceColor = 0;
      } else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
      }
    }
    function translateLevel(level) {
      if (level === 0) {
        return false;
      }
      return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
      };
    }
    function supportsColor(haveStream, streamIsTTY) {
      if (forceColor === 0) {
        return 0;
      }
      if (hasFlag2("color=16m") || hasFlag2("color=full") || hasFlag2("color=truecolor")) {
        return 3;
      }
      if (hasFlag2("color=256")) {
        return 2;
      }
      if (haveStream && !streamIsTTY && forceColor === void 0) {
        return 0;
      }
      const min = forceColor || 0;
      if (env.TERM === "dumb") {
        return min;
      }
      if (process.platform === "win32") {
        const osRelease = os.release().split(".");
        if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
          return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
      }
      if ("CI" in env) {
        if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
          return 1;
        }
        return min;
      }
      if ("TEAMCITY_VERSION" in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
      }
      if (env.COLORTERM === "truecolor") {
        return 3;
      }
      if ("TERM_PROGRAM" in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
        switch (env.TERM_PROGRAM) {
          case "iTerm.app":
            return version >= 3 ? 3 : 2;
          case "Apple_Terminal":
            return 2;
        }
      }
      if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
      }
      if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
      }
      if ("COLORTERM" in env) {
        return 1;
      }
      return min;
    }
    function getSupportLevel(stream) {
      const level = supportsColor(stream, stream && stream.isTTY);
      return translateLevel(level);
    }
    module.exports = {
      supportsColor: getSupportLevel,
      stdout: translateLevel(supportsColor(true, tty.isatty(1))),
      stderr: translateLevel(supportsColor(true, tty.isatty(2)))
    };
  }
});

// ../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/node.js
var require_node = __commonJS({
  "../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/node.js"(exports, module) {
    var tty = __require("tty");
    var util = __require("util");
    exports.init = init;
    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require_supports_color();
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error2) {
    }
    exports.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug2) {
      debug2.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug2.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// ../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/index.js
var require_src = __commonJS({
  "../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/index.js"(exports, module) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module.exports = require_browser();
    } else {
      module.exports = require_node();
    }
  }
});

// ../predicate-cli/src/docker.ts
import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
function findComposeDir() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.PREDICATE_COMPOSE_DIR,
    resolve(here, "compose"),
    resolve(here, "..", "compose"),
    resolve(here, "..", "..", "predicate-skill", "compose"),
    resolve(here, "..", "..", "..", "predicate-skill", "compose"),
    resolve(here, "..", "..", "..", "predicate-server")
  ].filter((p) => Boolean(p));
  for (const c of candidates) {
    if (c && existsSync(resolve(c, "docker-compose.yml"))) return c;
  }
  throw new Error(
    `Could not locate docker-compose.yml. Set PREDICATE_COMPOSE_DIR to the directory containing it, or run from the predicate repo root. Searched: ${candidates.join(", ")}`
  );
}
function dockerAvailable() {
  try {
    execSync("docker version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function compose(args, cwd) {
  const r = spawnSync("docker", ["compose", ...args], { cwd, stdio: "inherit" });
  return r.status ?? 1;
}

// ../predicate-cli/src/commands/up.ts
async function up() {
  if (!dockerAvailable()) {
    console.error("Docker not found. Install Docker Desktop or Docker Engine first.");
    return 2;
  }
  const dir = findComposeDir();
  console.log(`bringing Fuseki up from ${dir}`);
  return compose(["up", "-d"], dir);
}

// ../predicate-cli/src/commands/down.ts
async function down() {
  if (!dockerAvailable()) {
    console.error("Docker not found.");
    return 2;
  }
  const dir = findComposeDir();
  return compose(["down"], dir);
}

// ../predicate-mcp/src/sparql/client.ts
function err(status, body) {
  const e = new Error(`SPARQL error ${status}: ${body}`);
  e.status = status;
  e.body = body;
  return e;
}
function authHeader() {
  const user = process.env.PREDICATE_ADMIN_USER ?? "admin";
  const pass = process.env.PREDICATE_ADMIN_PASSWORD ?? "changeme";
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}
var SparqlClient = class {
  constructor(cfg) {
    this.cfg = cfg;
  }
  cfg;
  async select(query) {
    const res = await fetch(this.cfg.queryEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-query",
        "Accept": "application/sparql-results+json",
        "Authorization": authHeader()
      },
      body: query
    });
    if (!res.ok) throw err(res.status, await res.text());
    return await res.json();
  }
  async ask(query) {
    const res = await fetch(this.cfg.queryEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-query",
        "Accept": "application/sparql-results+json",
        "Authorization": authHeader()
      },
      body: query
    });
    if (!res.ok) throw err(res.status, await res.text());
    const json = await res.json();
    return json.boolean;
  }
  async update(query) {
    const res = await fetch(this.cfg.updateEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-update",
        "Authorization": authHeader()
      },
      body: query
    });
    if (!res.ok) throw err(res.status, await res.text());
  }
  async knownGraphs() {
    const r = await this.select(
      'SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } FILTER(STRSTARTS(STR(?g), "kg:")) }'
    );
    return r.results.bindings.map((b) => b.g.value);
  }
};

// ../predicate-mcp/src/config.ts
function loadConfig() {
  const raw = process.env.FUSEKI_URL ?? "http://localhost:3030";
  const fusekiUrl = raw.replace(/\/+$/, "");
  const dataset2 = process.env.PREDICATE_DATASET ?? "predicate";
  return {
    fusekiUrl,
    dataset: dataset2,
    queryEndpoint: `${fusekiUrl}/${dataset2}/query`,
    updateEndpoint: `${fusekiUrl}/${dataset2}/update`,
    dataEndpoint: `${fusekiUrl}/${dataset2}/data`
  };
}

// ../predicate-cli/src/commands/doctor.ts
async function doctor() {
  const cfg = loadConfig();
  const checks = [];
  checks.push({
    name: "docker installed",
    ok: dockerAvailable(),
    detail: dockerAvailable() ? "" : "install Docker Desktop"
  });
  const ping = await fetch(`${cfg.fusekiUrl}/$/ping`).catch(() => null);
  checks.push({
    name: "fuseki reachable",
    ok: Boolean(ping?.ok),
    detail: ping?.ok ? cfg.fusekiUrl : `not reachable at ${cfg.fusekiUrl} \u2014 try 'predicate up'`
  });
  if (ping?.ok) {
    const client = new SparqlClient(cfg);
    const tboxOk = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <kg:tbox> { ?c a owl:Class } }
    `).catch(() => false);
    checks.push({
      name: "kg:tbox loaded",
      ok: tboxOk,
      detail: tboxOk ? "" : "no classes found \u2014 try 'predicate up' (re-runs bootstrap)"
    });
  }
  const width = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) {
    const mark = c.ok ? "[x]" : "[ ]";
    const name = c.name.padEnd(width);
    const detail = c.detail ? `  \u2014 ${c.detail}` : "";
    console.log(`${mark} ${name}${detail}`);
  }
  return checks.every((c) => c.ok) ? 0 : 1;
}

// ../predicate-mcp/src/tools/kg-stats.ts
async function countGraph(client, graph) {
  const r = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${graph}> { ?s ?p ?o } }`
  );
  return parseInt(r.results.bindings[0].n.value, 10);
}
async function countClasses(client) {
  const r = await client.select(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
      GRAPH <kg:tbox> { ?c a owl:Class }
    }
  `);
  return parseInt(r.results.bindings[0].n.value, 10);
}
async function unusedConceptRatio(client, classCount) {
  if (classCount === 0) return 0;
  const r = await client.select(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
      GRAPH <kg:tbox> { ?c a owl:Class }
      FILTER NOT EXISTS {
        { GRAPH <kg:abox>     { ?x rdf:type ?c } }
        UNION
        { GRAPH <kg:inferred> { ?x rdf:type ?c } }
      }
    }
  `);
  const unused = parseInt(r.results.bindings[0].n.value, 10);
  return unused / classCount;
}
async function materializationLatencyP95(client) {
  const r = await client.select(`
    PREFIX pred: <https://predicate.dev/meta#>
    SELECT ?payload WHERE {
      GRAPH <kg:meta> {
        ?e a pred:MaterializationCompleted ;
           pred:payload ?payload .
      }
    }
  `);
  const values = r.results.bindings.map((b) => {
    const raw = b.payload?.value ?? "";
    const m = raw.match(/"elapsedMs"\s*:\s*(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }).filter((n) => Number.isFinite(n) && n > 0);
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const idx = Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1);
  return values[Math.max(idx, 0)];
}
async function kgStats(client) {
  const [abox, inferred, tbox] = await Promise.all([
    countGraph(client, "kg:abox"),
    countGraph(client, "kg:inferred"),
    countGraph(client, "kg:tbox")
  ]);
  const classes = await countClasses(client);
  const triples = abox + inferred + tbox;
  const denom = abox + inferred;
  const inferredRatio = denom === 0 ? 0 : inferred / denom;
  const unused = await unusedConceptRatio(client, classes);
  const p95 = await materializationLatencyP95(client);
  return {
    triples,
    abox,
    inferred,
    tbox,
    classes,
    inferredRatio,
    unusedConceptRatio: unused,
    materializationLatencyMsP95: p95
  };
}

// ../predicate-cli/src/commands/stats.ts
async function stats() {
  const client = new SparqlClient(loadConfig());
  const s = await kgStats(client);
  const rows = [
    ["triples", s.triples],
    ["abox", s.abox],
    ["inferred", s.inferred],
    ["tbox", s.tbox],
    ["classes", s.classes],
    ["inferredRatio", s.inferredRatio.toFixed(3)],
    ["unusedConceptRatio", s.unusedConceptRatio.toFixed(3)],
    ["materializationLatencyMsP95", s.materializationLatencyMsP95]
  ];
  const width = Math.max(...rows.map(([k]) => k.length));
  for (const [k, v] of rows) {
    console.log(`${k.padEnd(width)}  ${v}`);
  }
  return 0;
}

// ../predicate-cli/src/commands/sessionstart.ts
var META = "https://predicate.dev/meta#";
var OWL = "http://www.w3.org/2002/07/owl#";
async function sessionstart() {
  const cfg = loadConfig();
  const client = new SparqlClient(cfg);
  try {
    const goalsRes = await client.select(
      `PREFIX pred: <${META}>
       SELECT (COUNT(*) AS ?n) WHERE {
         GRAPH <kg:goals> { ?g pred:status "active" }
       }`
    );
    const classesRes = await client.select(
      `PREFIX owl: <${OWL}>
       SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
         GRAPH <kg:tbox> { ?c a owl:Class }
       }`
    );
    const goals = goalsRes.results.bindings[0]?.n?.value ?? "0";
    const classes = classesRes.results.bindings[0]?.n?.value ?? "0";
    console.log(
      `Predicate ready: ${goals} active goals, ${classes} TBox classes. Use kg_explore_schema before drafting SPARQL.`
    );
    return 0;
  } catch {
    console.log(
      `Predicate: Fuseki not reachable; KG tools may fail. Start it with \`predicate up\`.`
    );
    return 0;
  }
}

// ../predicate-mcp/src/sparql/escape.ts
var ILLEGAL_IRI = /[\s<>"{}|^`\\]/;
function escapeIRI(iri) {
  if (ILLEGAL_IRI.test(iri)) {
    throw new Error(`Illegal characters in IRI: ${JSON.stringify(iri)}`);
  }
  return `<${iri}>`;
}
function escapeLiteral(value) {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

// ../predicate-agent/src/gap-detector.ts
var C = "https://predicate.dev/codebase#";
var REQUIRED_PREDICATES = {
  "why-broken": [`${C}dependsOn`, `${C}lastModifiedIn`],
  "find-callers": [`${C}calls`],
  "find-dependencies-direct": [`${C}imports`],
  "find-dependencies-trans": [`${C}dependsOn`],
  "find-readers-of": [`${C}reads`],
  "find-symbol-in-file": [`${C}declaredIn`]
};

// ../predicate-mcp/src/graphs.ts
var GRAPH = {
  tbox: "kg:tbox",
  tboxStaging: "kg:tbox-staging",
  abox: "kg:abox",
  inferred: "kg:inferred",
  provenance: "kg:provenance",
  goals: "kg:goals",
  usage: "kg:usage",
  meta: "kg:meta"
};

// ../predicate-agent/src/schema-proposer.ts
var META2 = "https://predicate.dev/meta#";
var DEFAULT_TTL_DAYS = 7;
function newProposalId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `urn:predicate:proposal:P-${ts}-${rand}`;
}
function newEventId(kind) {
  return `urn:predicate:event:${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function renderTerm(t) {
  if (t.type === "uri") return escapeIRI(t.value);
  if (t.datatype) return `${escapeLiteral(t.value)}^^${escapeIRI(t.datatype)}`;
  return escapeLiteral(t.value);
}
function tripleSparql(q) {
  return `${escapeIRI(q.s)} ${escapeIRI(q.p)} ${renderTerm(q.o)}`;
}
var SchemaProposer = class {
  constructor(client) {
    this.client = client;
  }
  client;
  async propose(delta, meta) {
    const id = newProposalId();
    const proposedAt = (/* @__PURE__ */ new Date()).toISOString();
    const expiresAt = new Date(
      Date.now() + (meta.ttlDays ?? DEFAULT_TTL_DAYS) * 864e5
    ).toISOString();
    const triplesToTag = [...delta.add];
    if (delta.shapes) triplesToTag.push(...delta.shapes);
    const tagTripleStmts = triplesToTag.map((q) => `
      << ${tripleSparql(q)} >>
        pred:proposalId ${escapeIRI(id)} .
      ${tripleSparql(q)} .
    `).join("\n");
    const goalLine = meta.motivatingGoal ? `${escapeIRI(id)} pred:motivatingGoal ${escapeIRI(meta.motivatingGoal)} .` : "";
    const parentLine = delta.kind === "refine-class" ? `${escapeIRI(id)} pred:parent ${escapeIRI(delta.parent)} .` : "";
    const migrationLine = delta.kind === "breaking" ? `${escapeIRI(id)} pred:migration ${escapeLiteral(delta.migration)} .` : "";
    await this.client.update(`
      PREFIX pred: <${META2}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:tbox-staging> {
          ${tagTripleStmts}
          ${escapeIRI(id)} a pred:Proposal ;
            pred:kind          ${escapeLiteral(delta.kind)} ;
            pred:justification ${escapeLiteral(meta.justification)} ;
            pred:proposedAt    "${proposedAt}"^^xsd:dateTime ;
            pred:expiresAt     "${expiresAt}"^^xsd:dateTime ;
            pred:useCount      "0"^^xsd:integer .
          ${goalLine}
          ${parentLine}
          ${migrationLine}
        }
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId("schema-proposed"))} a pred:SchemaProposed ;
            pred:at    "${proposedAt}"^^xsd:dateTime ;
            pred:actor "SchemaProposer" ;
            pred:goal  ${escapeIRI(id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({
      kind: delta.kind,
      justification: meta.justification,
      motivatingGoal: meta.motivatingGoal
    }))} .
        }
      }
    `);
    return id;
  }
};

// ../predicate-agent/src/promotion-sweeper.ts
import { writeFileSync } from "node:fs";
import { resolve as resolve2 } from "node:path";

// ../predicate-reasoner/src/rules/r01-subclassof-transitivity.ts
var SUBCLASS_OF = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
var r01 = {
  id: "r01-subclassof-transitivity",
  name: "rdfs:subClassOf transitivity",
  insertWhere: (cfg) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?c } }
    WHERE {
      {
        { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subClassOf ?b } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?b } }
      }
      {
        { GRAPH <${cfg.tboxGraph}>     { ?b rdfs:subClassOf ?c } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?b rdfs:subClassOf ?c } }
      }
      FILTER (?a != ?c)
      FILTER NOT EXISTS { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subClassOf ?c } }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?c } }
    }
  `,
  backward: {
    matches: (q) => q.p === SUBCLASS_OF,
    premiseQuery: (q) => {
      const s = q.s;
      const o = typeof q.o === "string" ? q.o : q.o.value;
      return `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?mid WHERE {
          {
            { GRAPH <kg:tbox>     { <${s}> rdfs:subClassOf ?mid } }
            UNION
            { GRAPH <kg:inferred> { <${s}> rdfs:subClassOf ?mid } }
          }
          {
            { GRAPH <kg:tbox>     { ?mid rdfs:subClassOf <${o}> } }
            UNION
            { GRAPH <kg:inferred> { ?mid rdfs:subClassOf <${o}> } }
          }
        } LIMIT 1
      `;
    },
    buildPremises: (q, binding) => {
      const o = typeof q.o === "string" ? q.o : q.o.value;
      return [
        { s: q.s, p: SUBCLASS_OF, o: binding.mid },
        { s: binding.mid, p: SUBCLASS_OF, o }
      ];
    }
  }
};

// ../predicate-reasoner/src/rules/r02-subpropertyof-transitivity.ts
var r02 = {
  id: "r02-subpropertyof-transitivity",
  name: "rdfs:subPropertyOf transitivity",
  insertWhere: (cfg) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subPropertyOf ?c } }
    WHERE {
      {
        { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subPropertyOf ?b } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subPropertyOf ?b } }
      }
      {
        { GRAPH <${cfg.tboxGraph}>     { ?b rdfs:subPropertyOf ?c } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?b rdfs:subPropertyOf ?c } }
      }
      FILTER (?a != ?c)
      FILTER NOT EXISTS { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subPropertyOf ?c } }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subPropertyOf ?c } }
    }
  `
};

// ../predicate-reasoner/src/closure.ts
function closureEligible(s, p, o, cfg) {
  const aboxBlocks = cfg.aboxGraphs.map((g) => `
    {
      GRAPH <${g}> { ${s} ${p} ${o} }
      FILTER EXISTS {
        GRAPH <kg:provenance> {
          << ${s} ${p} ${o} >> <https://predicate.dev/meta#confidence> ?conf .
          FILTER (?conf >= ${cfg.closureCutoff})
        }
      }
    }
  `).join("\n    UNION\n");
  const aboxUnion = aboxBlocks.length > 0 ? `
    UNION
    ${aboxBlocks}` : "";
  return `
    {
      GRAPH <${cfg.tboxGraph}> { ${s} ${p} ${o} }
    }
    UNION
    {
      GRAPH <${cfg.inferredGraph}> { ${s} ${p} ${o} }
    }${aboxUnion}
  `;
}

// ../predicate-reasoner/src/rules/r03-transitive-property.ts
var r03 = {
  id: "r03-transitive-property",
  name: "owl:TransitiveProperty",
  insertWhere: (cfg) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?p ?z } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:TransitiveProperty }
      {
        ${closureEligible("?x", "?p", "?y", cfg)}
      }
      {
        ${closureEligible("?y", "?p", "?z", cfg)}
      }
      FILTER (?x != ?z)
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?p ?z } }
      ${cfg.aboxGraphs.map((g) => `FILTER NOT EXISTS { GRAPH <${g}> { ?x ?p ?z } }`).join("\n      ")}
    }
  `,
  backward: {
    matches: () => true,
    premiseQuery: (q) => {
      const o = typeof q.o === "string" ? q.o : q.o.value;
      return `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        SELECT ?mid WHERE {
          GRAPH <kg:tbox> { <${q.p}> a owl:TransitiveProperty }
          {
            { GRAPH <kg:abox>     { <${q.s}> <${q.p}> ?mid } }
            UNION
            { GRAPH <kg:inferred> { <${q.s}> <${q.p}> ?mid } }
          }
          {
            { GRAPH <kg:abox>     { ?mid <${q.p}> <${o}> } }
            UNION
            { GRAPH <kg:inferred> { ?mid <${q.p}> <${o}> } }
          }
        } LIMIT 1
      `;
    },
    buildPremises: (q, binding) => {
      const o = typeof q.o === "string" ? q.o : q.o.value;
      return [
        { s: q.s, p: q.p, o: binding.mid },
        { s: binding.mid, p: q.p, o }
      ];
    }
  }
};

// ../predicate-reasoner/src/rules/r04-inverse-of.ts
var r04 = {
  id: "r04-inverse-of",
  name: "owl:inverseOf",
  insertWhere: (cfg) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y ?q ?x } }
    WHERE {
      {
        GRAPH <${cfg.tboxGraph}> { ?p owl:inverseOf ?q }
      } UNION {
        GRAPH <${cfg.tboxGraph}> { ?q owl:inverseOf ?p }
      }
      {
        ${closureEligible("?x", "?p", "?y", cfg)}
      }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y ?q ?x } }
    }
  `
};

// ../predicate-reasoner/src/rules/r05-property-chain.ts
var r05 = {
  id: "r05-property-chain",
  name: "owl:propertyChainAxiom (length 2)",
  insertWhere: (cfg) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?q ?z } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> {
        ?q owl:propertyChainAxiom ?list .
        ?list rdf:first ?p1 ; rdf:rest ?rest .
        ?rest rdf:first ?p2 ; rdf:rest rdf:nil .
      }
      {
        ${closureEligible("?x", "?p1", "?y", cfg)}
      }
      {
        ${closureEligible("?y", "?p2", "?z", cfg)}
      }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?q ?z } }
    }
  `,
  backward: {
    matches: () => true,
    premiseQuery: (q) => {
      const o = typeof q.o === "string" ? q.o : q.o.value;
      return `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT ?p1 ?p2 ?mid WHERE {
          GRAPH <kg:tbox> {
            <${q.p}> owl:propertyChainAxiom ?list .
            ?list rdf:first ?p1 ; rdf:rest ?rest .
            ?rest rdf:first ?p2 ; rdf:rest rdf:nil .
          }
          {
            { GRAPH <kg:abox>     { <${q.s}> ?p1 ?mid } }
            UNION
            { GRAPH <kg:inferred> { <${q.s}> ?p1 ?mid } }
          }
          {
            { GRAPH <kg:abox>     { ?mid ?p2 <${o}> } }
            UNION
            { GRAPH <kg:inferred> { ?mid ?p2 <${o}> } }
          }
        } LIMIT 1
      `;
    },
    buildPremises: (q, binding) => {
      const o = typeof q.o === "string" ? q.o : q.o.value;
      return [
        { s: q.s, p: binding.p1, o: binding.mid },
        { s: binding.mid, p: binding.p2, o }
      ];
    }
  }
};

// ../predicate-reasoner/src/rules/r06-domain.ts
var r06 = {
  id: "r06-domain",
  name: "rdfs:domain \u2192 rdf:type",
  insertWhere: (cfg) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p rdfs:domain ?D }
      ${closureEligible("?x", "?p", "?y", cfg)}
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    }
  `
};

// ../predicate-reasoner/src/rules/r07-range.ts
var r07 = {
  id: "r07-range",
  name: "rdfs:range \u2192 rdf:type",
  insertWhere: (cfg) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y rdf:type ?R } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p rdfs:range ?R }
      ${closureEligible("?x", "?p", "?y", cfg)}
      FILTER (isIRI(?y))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y rdf:type ?R } }
    }
  `
};

// ../predicate-reasoner/src/rules/r08-functional-sameas.ts
var r08 = {
  id: "r08-functional-sameas",
  name: "owl:FunctionalProperty \u2192 owl:sameAs",
  insertWhere: (cfg) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y1 owl:sameAs ?y2 } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:FunctionalProperty }
      ${closureEligible("?x", "?p", "?y1", cfg)}
      ${closureEligible("?x", "?p", "?y2", cfg)}
      FILTER (str(?y1) < str(?y2))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y1 owl:sameAs ?y2 } }
    }
  `
};

// ../predicate-reasoner/src/rules/r09-inverse-functional.ts
var r09 = {
  id: "r09-inverse-functional",
  name: "owl:InverseFunctionalProperty \u2192 owl:sameAs",
  insertWhere: (cfg) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:InverseFunctionalProperty }
      ${closureEligible("?x1", "?p", "?y", cfg)}
      ${closureEligible("?x2", "?p", "?y", cfg)}
      FILTER (str(?x1) < str(?x2))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    }
  `
};

// ../predicate-reasoner/src/rules/r10-symmetric.ts
var r10 = {
  id: "r10-symmetric",
  name: "owl:SymmetricProperty",
  insertWhere: (cfg) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y ?p ?x } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:SymmetricProperty }
      ${closureEligible("?x", "?p", "?y", cfg)}
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y ?p ?x } }
    }
  `
};

// ../predicate-reasoner/src/rules/r12-equivalent-class.ts
var r12 = {
  id: "r12-equivalent-class",
  name: "owl:equivalentClass \u2192 bidirectional subClassOf",
  insertWhere: (cfg) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT {
      GRAPH <${cfg.inferredGraph}> {
        ?a rdfs:subClassOf ?b .
        ?b rdfs:subClassOf ?a .
      }
    }
    WHERE {
      {
        GRAPH <${cfg.tboxGraph}> { ?a owl:equivalentClass ?b }
      } UNION {
        GRAPH <${cfg.tboxGraph}> { ?b owl:equivalentClass ?a }
      }
      FILTER (?a != ?b)
    }
  `
};

// ../predicate-reasoner/src/rules/r13-equivalent-property.ts
var r13 = {
  id: "r13-equivalent-property",
  name: "owl:equivalentProperty \u2192 bidirectional subPropertyOf",
  insertWhere: (cfg) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT {
      GRAPH <${cfg.inferredGraph}> {
        ?p rdfs:subPropertyOf ?q .
        ?q rdfs:subPropertyOf ?p .
      }
    }
    WHERE {
      {
        GRAPH <${cfg.tboxGraph}> { ?p owl:equivalentProperty ?q }
      } UNION {
        GRAPH <${cfg.tboxGraph}> { ?q owl:equivalentProperty ?p }
      }
      FILTER (?p != ?q)
    }
  `
};

// ../predicate-reasoner/src/rules/r14-has-key.ts
var r14 = {
  id: "r14-has-key",
  name: "owl:hasKey (single-property keys) \u2192 owl:sameAs",
  insertWhere: (cfg) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> {
        ?C owl:hasKey ?list .
        ?list rdf:first ?p ; rdf:rest rdf:nil .
      }
      {
        { GRAPH <${cfg.aboxGraphs[0] ?? "kg:abox-fallback"}> { ?x1 rdf:type ?C } }
        UNION { GRAPH <${cfg.inferredGraph}> { ?x1 rdf:type ?C } }
      }
      {
        { GRAPH <${cfg.aboxGraphs[0] ?? "kg:abox-fallback"}> { ?x2 rdf:type ?C } }
        UNION { GRAPH <${cfg.inferredGraph}> { ?x2 rdf:type ?C } }
      }
      ${closureEligible("?x1", "?p", "?v", cfg)}
      ${closureEligible("?x2", "?p", "?v", cfg)}
      FILTER (str(?x1) < str(?x2))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    }
  `
};

// ../predicate-reasoner/src/rules/r15-type-propagation.ts
var RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
var SUBCLASS_OF2 = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
var r15 = {
  id: "r15-type-propagation",
  name: "rdf:type propagation via rdfs:subClassOf",
  insertWhere: (cfg) => `
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    WHERE {
      ${closureEligible("?x", "rdf:type", "?C", cfg)}
      {
        { GRAPH <${cfg.tboxGraph}>     { ?C rdfs:subClassOf ?D } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?C rdfs:subClassOf ?D } }
      }
      FILTER (?C != ?D)
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    }
  `,
  backward: {
    matches: (q) => q.p === RDF_TYPE,
    premiseQuery: (q) => {
      const o = typeof q.o === "string" ? q.o : q.o.value;
      return `
        PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?C WHERE {
          {
            { GRAPH <kg:abox>     { <${q.s}> rdf:type ?C } }
            UNION
            { GRAPH <kg:inferred> { <${q.s}> rdf:type ?C } }
          }
          {
            { GRAPH <kg:tbox>     { ?C rdfs:subClassOf <${o}> } }
            UNION
            { GRAPH <kg:inferred> { ?C rdfs:subClassOf <${o}> } }
          }
          FILTER (?C != <${o}>)
        } LIMIT 1
      `;
    },
    buildPremises: (q, binding) => {
      const o = typeof q.o === "string" ? q.o : q.o.value;
      return [
        { s: q.s, p: RDF_TYPE, o: binding.C },
        { s: binding.C, p: SUBCLASS_OF2, o }
      ];
    }
  }
};

// ../predicate-reasoner/src/rules/r16-subpropertyof-instance.ts
var SUBPROPERTY_OF = "http://www.w3.org/2000/01/rdf-schema#subPropertyOf";
var r16 = {
  id: "r16-subpropertyof-instance",
  name: "rdfs:subPropertyOf instance propagation",
  insertWhere: (cfg) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?q ?y } }
    WHERE {
      {
        { GRAPH <${cfg.tboxGraph}>     { ?p rdfs:subPropertyOf ?q } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?p rdfs:subPropertyOf ?q } }
      }
      FILTER (?p != ?q)
      ${closureEligible("?x", "?p", "?y", cfg)}
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?q ?y } }
    }
  `,
  backward: {
    matches: (q) => {
      return q.p !== SUBPROPERTY_OF;
    },
    premiseQuery: (q) => {
      const o = typeof q.o === "string" ? `<${q.o}>` : `"${q.o.value}"`;
      return `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?subProp WHERE {
          {
            { GRAPH <kg:tbox>     { ?subProp rdfs:subPropertyOf <${q.p}> } }
            UNION
            { GRAPH <kg:inferred> { ?subProp rdfs:subPropertyOf <${q.p}> } }
          }
          {
            { GRAPH <kg:abox>     { <${q.s}> ?subProp ${o} } }
            UNION
            { GRAPH <kg:tbox>     { <${q.s}> ?subProp ${o} } }
            UNION
            { GRAPH <kg:inferred> { <${q.s}> ?subProp ${o} } }
          }
          FILTER (?subProp != <${q.p}>)
        } LIMIT 1
      `;
    },
    buildPremises: (q, binding) => {
      const o = typeof q.o === "string" ? q.o : q.o.value;
      return [
        { s: binding.subProp, p: SUBPROPERTY_OF, o: q.p },
        { s: q.s, p: binding.subProp, o }
      ];
    }
  }
};

// ../predicate-reasoner/src/rules/r11-disjoint-with.ts
var r11 = {
  id: "r11-disjoint-with",
  name: "owl:disjointWith inconsistency detection",
  insertWhere: () => "",
  // no-op for fixpoint loop
  findInconsistencies: async (client, cfg) => {
    const aboxGraph = cfg.aboxGraphs[0] ?? "kg:abox";
    const r = await client.select(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?x ?a ?b WHERE {
        GRAPH <${cfg.tboxGraph}> { ?a owl:disjointWith ?b }
        {
          { GRAPH <${aboxGraph}> { ?x rdf:type ?a } }
          UNION
          { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?a } }
        }
        {
          { GRAPH <${aboxGraph}> { ?x rdf:type ?b } }
          UNION
          { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?b } }
        }
        FILTER (str(?a) < str(?b))
      }
    `);
    return r.results.bindings.map((b) => ({
      kind: "disjoint-class",
      description: `${b.x.value} is typed as both ${b.a.value} and ${b.b.value} which are owl:disjointWith`,
      triples: [
        { s: b.x.value, p: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", o: b.a.value },
        { s: b.x.value, p: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", o: b.b.value }
      ]
    }));
  }
};

// ../predicate-reasoner/src/rules/index.ts
var RULES = [
  r01,
  r02,
  r03,
  r04,
  r05,
  r06,
  r07,
  r08,
  r09,
  r10,
  r12,
  r13,
  r14,
  r15,
  r16
];

// ../predicate-reasoner/src/fixpoint.ts
var MAX_ITERATIONS = 10;
async function runFixpoint(client, rules, cfg) {
  await client.update(`DROP SILENT GRAPH <${cfg.inferredGraph}>`);
  await client.update(`CREATE SILENT GRAPH <${cfg.inferredGraph}>`);
  let lastCount = -1;
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    for (const rule of rules) {
      await client.update(rule.insertWhere(cfg));
    }
    const r = await client.select(
      `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${cfg.inferredGraph}> { ?s ?p ?o } }`
    );
    const n = parseInt(r.results.bindings[0].n.value, 10);
    if (n === lastCount) return { iterations: i, inferredCount: n };
    lastCount = n;
  }
  throw new Error(
    `Fixpoint did not converge in ${MAX_ITERATIONS} iterations (current inferred count: ${lastCount}). On the v1 OWL 2 RL rule subset this should be impossible \u2014 investigate for a divergent rule or an unbounded property-chain depth.`
  );
}

// ../predicate-reasoner/src/shacl.ts
var import_n3 = __toESM(require_lib(), 1);

// ../../node_modules/.pnpm/@rdfjs+environment@1.0.0/node_modules/@rdfjs/environment/Environment.js
var Environment = class _Environment {
  constructor(factories, { bind = false } = {}) {
    this._factories = factories.slice();
    for (const factory3 of this._factories) {
      if (typeof factory3.prototype.init === "function") {
        factory3.prototype.init.call(this);
      }
      for (const method of factory3.exports || []) {
        if (bind) {
          this[method] = factory3.prototype[method].bind(this);
        } else {
          this[method] = factory3.prototype[method];
        }
      }
    }
  }
  clone() {
    const env = new _Environment(this._factories);
    for (const factory3 of env._factories) {
      if (typeof factory3.prototype.clone === "function") {
        factory3.prototype.clone.call(env, this);
      }
    }
    return env;
  }
};
var Environment_default = Environment;

// ../../node_modules/.pnpm/@rdfjs+data-model@2.1.1/node_modules/@rdfjs/data-model/lib/BlankNode.js
var BlankNode = class {
  constructor(id) {
    this.value = id;
  }
  equals(other) {
    return !!other && other.termType === this.termType && other.value === this.value;
  }
};
BlankNode.prototype.termType = "BlankNode";
var BlankNode_default = BlankNode;

// ../../node_modules/.pnpm/@rdfjs+data-model@2.1.1/node_modules/@rdfjs/data-model/lib/DefaultGraph.js
var DefaultGraph = class {
  equals(other) {
    return !!other && other.termType === this.termType;
  }
};
DefaultGraph.prototype.termType = "DefaultGraph";
DefaultGraph.prototype.value = "";
var DefaultGraph_default = DefaultGraph;

// ../../node_modules/.pnpm/@rdfjs+data-model@2.1.1/node_modules/@rdfjs/data-model/lib/fromTerm.js
function fromTerm(factory3, original) {
  if (!original) {
    return null;
  }
  if (original.termType === "BlankNode") {
    return factory3.blankNode(original.value);
  }
  if (original.termType === "DefaultGraph") {
    return factory3.defaultGraph();
  }
  if (original.termType === "Literal") {
    return factory3.literal(original.value, original.language || factory3.namedNode(original.datatype.value));
  }
  if (original.termType === "NamedNode") {
    return factory3.namedNode(original.value);
  }
  if (original.termType === "Quad") {
    const subject = factory3.fromTerm(original.subject);
    const predicate = factory3.fromTerm(original.predicate);
    const object = factory3.fromTerm(original.object);
    const graph = factory3.fromTerm(original.graph);
    return factory3.quad(subject, predicate, object, graph);
  }
  if (original.termType === "Variable") {
    return factory3.variable(original.value);
  }
  throw new Error(`unknown termType ${original.termType}`);
}
var fromTerm_default = fromTerm;

// ../../node_modules/.pnpm/@rdfjs+data-model@2.1.1/node_modules/@rdfjs/data-model/lib/Literal.js
var Literal = class {
  constructor(value, language, datatype, direction = "") {
    this.value = value;
    this.language = language;
    this.datatype = datatype;
    this.direction = direction;
  }
  equals(other) {
    return !!other && other.termType === this.termType && other.value === this.value && other.language === this.language && other.datatype.equals(this.datatype) && (other.direction || "") === this.direction;
  }
};
Literal.prototype.termType = "Literal";
var Literal_default = Literal;

// ../../node_modules/.pnpm/@rdfjs+data-model@2.1.1/node_modules/@rdfjs/data-model/lib/NamedNode.js
var NamedNode = class {
  constructor(iri) {
    this.value = iri;
  }
  equals(other) {
    return !!other && other.termType === this.termType && other.value === this.value;
  }
};
NamedNode.prototype.termType = "NamedNode";
var NamedNode_default = NamedNode;

// ../../node_modules/.pnpm/@rdfjs+data-model@2.1.1/node_modules/@rdfjs/data-model/lib/Quad.js
var Quad = class {
  constructor(subject, predicate, object, graph) {
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
    this.graph = graph;
  }
  equals(other) {
    return !!other && (other.termType === "Quad" || !other.termType) && other.subject.equals(this.subject) && other.predicate.equals(this.predicate) && other.object.equals(this.object) && other.graph.equals(this.graph);
  }
};
Quad.prototype.termType = "Quad";
Quad.prototype.value = "";
var Quad_default = Quad;

// ../../node_modules/.pnpm/@rdfjs+data-model@2.1.1/node_modules/@rdfjs/data-model/lib/Variable.js
var Variable = class {
  constructor(name) {
    this.value = name;
  }
  equals(other) {
    return !!other && other.termType === this.termType && other.value === this.value;
  }
};
Variable.prototype.termType = "Variable";
var Variable_default = Variable;

// ../../node_modules/.pnpm/@rdfjs+data-model@2.1.1/node_modules/@rdfjs/data-model/Factory.js
var dirLangStringDatatype = new NamedNode_default("http://www.w3.org/1999/02/22-rdf-syntax-ns#dirLangString");
var langStringDatatype = new NamedNode_default("http://www.w3.org/1999/02/22-rdf-syntax-ns#langString");
var stringDatatype = new NamedNode_default("http://www.w3.org/2001/XMLSchema#string");
var DataFactory = class {
  constructor() {
    this.init();
  }
  init() {
    this._data = {
      blankNodeCounter: 0,
      defaultGraph: new DefaultGraph_default()
    };
  }
  namedNode(value) {
    return new NamedNode_default(value);
  }
  blankNode(value) {
    value = value || "b" + ++this._data.blankNodeCounter;
    return new BlankNode_default(value);
  }
  literal(value, languageOrDatatype) {
    if (typeof languageOrDatatype === "string") {
      return new Literal_default(value, languageOrDatatype, langStringDatatype);
    } else if (typeof languageOrDatatype?.language === "string") {
      return new Literal_default(
        value,
        languageOrDatatype.language,
        languageOrDatatype.direction ? dirLangStringDatatype : langStringDatatype,
        languageOrDatatype.direction
      );
    } else {
      return new Literal_default(value, "", languageOrDatatype || stringDatatype);
    }
  }
  variable(value) {
    return new Variable_default(value);
  }
  defaultGraph() {
    return this._data.defaultGraph;
  }
  quad(subject, predicate, object, graph = this.defaultGraph()) {
    return new Quad_default(subject, predicate, object, graph);
  }
  fromTerm(original) {
    return fromTerm_default(this, original);
  }
  fromQuad(original) {
    return fromTerm_default(this, original);
  }
};
DataFactory.exports = [
  "blankNode",
  "defaultGraph",
  "fromQuad",
  "fromTerm",
  "literal",
  "namedNode",
  "quad",
  "variable"
];
var Factory_default = DataFactory;

// ../../node_modules/.pnpm/@rdfjs+dataset@2.0.2/node_modules/@rdfjs/dataset/DatasetCore.js
function isString(s) {
  return typeof s === "string" || s instanceof String;
}
var xsdString = "http://www.w3.org/2001/XMLSchema#string";
function termToId(term2) {
  if (typeof term2 === "string") {
    return term2;
  }
  if (!term2) {
    return "";
  }
  if (typeof term2.id !== "undefined" && term2.termType !== "Quad") {
    return term2.id;
  }
  let subject, predicate, object, graph;
  switch (term2.termType) {
    case "NamedNode":
      return term2.value;
    case "BlankNode":
      return `_:${term2.value}`;
    case "Variable":
      return `?${term2.value}`;
    case "DefaultGraph":
      return "";
    case "Literal":
      if (term2.language) {
        return `"${term2.value}"@${term2.language}`;
      }
      return `"${term2.value}"${term2.datatype && term2.datatype.value !== xsdString ? `^^${term2.datatype.value}` : ""}`;
    case "Quad":
      subject = escapeQuotes(termToId(term2.subject));
      predicate = escapeQuotes(termToId(term2.predicate));
      object = escapeQuotes(termToId(term2.object));
      graph = term2.graph.termType === "DefaultGraph" ? "" : ` ${termToId(term2.graph)}`;
      return `<<${subject} ${predicate} ${object}${graph}>>`;
    default:
      throw new Error(`Unexpected termType: ${term2.termType}`);
  }
}
var escapedLiteral = /^"(.*".*)(?="[^"]*$)/;
function escapeQuotes(id) {
  return id.replace(escapedLiteral, (_, quoted) => `"${quoted.replace(/"/g, '""')}`);
}
var DatasetCore = class {
  constructor(quads) {
    this._size = 0;
    this._graphs = /* @__PURE__ */ Object.create(null);
    this._id = 0;
    this._ids = /* @__PURE__ */ Object.create(null);
    this._ids["><"] = 0;
    this._entities = /* @__PURE__ */ Object.create(null);
    this._quads = /* @__PURE__ */ new Map();
    if (quads) {
      for (const quad2 of quads) {
        this.add(quad2);
      }
    }
  }
  get size() {
    let size = this._size;
    if (size !== null) {
      return size;
    }
    size = 0;
    const graphs = this._graphs;
    let subjects, subject;
    for (const graphKey in graphs) {
      for (const subjectKey in subjects = graphs[graphKey].subjects) {
        for (const predicateKey in subject = subjects[subjectKey]) {
          size += Object.keys(subject[predicateKey]).length;
        }
      }
    }
    this._size = size;
    return this._size;
  }
  add(quad2) {
    let subject = termToId(quad2.subject);
    let predicate = termToId(quad2.predicate);
    let object = termToId(quad2.object);
    const graph = termToId(quad2.graph);
    let graphItem = this._graphs[graph];
    if (!graphItem) {
      graphItem = this._graphs[graph] = { subjects: {}, predicates: {}, objects: {} };
      Object.freeze(graphItem);
    }
    const ids = this._ids;
    const entities = this._entities;
    subject = ids[subject] || (ids[entities[++this._id] = subject] = this._id);
    predicate = ids[predicate] || (ids[entities[++this._id] = predicate] = this._id);
    object = ids[object] || (ids[entities[++this._id] = object] = this._id);
    this._addToIndex(graphItem.subjects, subject, predicate, object);
    this._addToIndex(graphItem.predicates, predicate, object, subject);
    this._addToIndex(graphItem.objects, object, subject, predicate);
    this._setQuad(subject, predicate, object, graph, quad2);
    this._size = null;
    return this;
  }
  delete(quad2) {
    let subject = termToId(quad2.subject);
    let predicate = termToId(quad2.predicate);
    let object = termToId(quad2.object);
    const graph = termToId(quad2.graph);
    const ids = this._ids;
    const graphs = this._graphs;
    let graphItem, subjects, predicates;
    if (!(subject = ids[subject]) || !(predicate = ids[predicate]) || !(object = ids[object]) || !(graphItem = graphs[graph]) || !(subjects = graphItem.subjects[subject]) || !(predicates = subjects[predicate]) || !(object in predicates)) {
      return this;
    }
    this._removeFromIndex(graphItem.subjects, subject, predicate, object);
    this._removeFromIndex(graphItem.predicates, predicate, object, subject);
    this._removeFromIndex(graphItem.objects, object, subject, predicate);
    if (this._size !== null) {
      this._size--;
    }
    this._deleteQuad(subject, predicate, object, graph);
    for (subject in graphItem.subjects) {
      return this;
    }
    delete graphs[graph];
    return this;
  }
  has(quad2) {
    const subject = termToId(quad2.subject);
    const predicate = termToId(quad2.predicate);
    const object = termToId(quad2.object);
    const graph = termToId(quad2.graph);
    const graphItem = this._graphs[graph];
    if (!graphItem) {
      return false;
    }
    const ids = this._ids;
    let subjectId, predicateId, objectId;
    if (isString(subject) && !(subjectId = ids[subject]) || isString(predicate) && !(predicateId = ids[predicate]) || isString(object) && !(objectId = ids[object])) {
      return false;
    }
    return this._countInIndex(graphItem.objects, objectId, subjectId, predicateId) === 1;
  }
  match(subject, predicate, object, graph) {
    return this._createDataset(this._match(subject, predicate, object, graph));
  }
  [Symbol.iterator]() {
    return this._match()[Symbol.iterator]();
  }
  // ## Private methods
  // ### `_addToIndex` adds a quad to a three-layered index.
  // Returns if the index has changed, if the entry did not already exist.
  _addToIndex(index0, key0, key1, key2) {
    const index1 = index0[key0] || (index0[key0] = {});
    const index2 = index1[key1] || (index1[key1] = {});
    const existed = key2 in index2;
    if (!existed) {
      index2[key2] = null;
    }
    return !existed;
  }
  // ### `_removeFromIndex` removes a quad from a three-layered index
  _removeFromIndex(index0, key0, key1, key2) {
    const index1 = index0[key0];
    const index2 = index1[key1];
    delete index2[key2];
    for (const key in index2) {
      return;
    }
    delete index1[key1];
    for (const key in index1) {
      return;
    }
    delete index0[key0];
  }
  // ### `_findInIndex` finds a set of quads in a three-layered index.
  // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // Any of these keys can be undefined, which is interpreted as a wildcard.
  // `name0`, `name1`, and `name2` are the names of the keys at each level,
  // used when reconstructing the resulting quad
  // (for instance: _subject_, _predicate_, and _object_).
  // Finally, `graph` will be the graph of the created quads.
  // If `callback` is given, each result is passed through it
  // and iteration halts when it returns truthy for any quad.
  // If instead `array` is given, each result is added to the array.
  _findInIndex(index0, key0, key1, key2, name0, name1, name2, graph, callback, array) {
    let tmp, index1, index2;
    if (key0) {
      (tmp = index0, index0 = {})[key0] = tmp[key0];
    }
    for (const value0 in index0) {
      index1 = index0[value0];
      if (index1) {
        if (key1) {
          (tmp = index1, index1 = {})[key1] = tmp[key1];
        }
        for (const value1 in index1) {
          index2 = index1[value1];
          if (index2) {
            const values = key2 ? key2 in index2 ? [key2] : [] : Object.keys(index2);
            for (let l = 0; l < values.length; l++) {
              const parts = {
                [name0]: value0,
                [name1]: value1,
                [name2]: values[l]
              };
              const quad2 = this._getQuad(parts.subject, parts.predicate, parts.object, graph);
              if (array) {
                array.push(quad2);
              } else if (callback(quad2)) {
                return true;
              }
            }
          }
        }
      }
    }
    return array;
  }
  // ### `_countInIndex` counts matching quads in a three-layered index.
  // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // Any of these keys can be undefined, which is interpreted as a wildcard.
  _countInIndex(index0, key0, key1, key2) {
    let count = 0;
    let tmp, index1, index2;
    if (key0) {
      (tmp = index0, index0 = {})[key0] = tmp[key0];
    }
    for (const value0 in index0) {
      index1 = index0[value0];
      if (index1) {
        if (key1) {
          (tmp = index1, index1 = {})[key1] = tmp[key1];
        }
        for (const value1 in index1) {
          index2 = index1[value1];
          if (index2) {
            if (key2) {
              key2 in index2 && count++;
            } else {
              count += Object.keys(index2).length;
            }
          }
        }
      }
    }
    return count;
  }
  // ### `_getGraphs` returns an array with the given graph,
  // or all graphs if the argument is null or undefined.
  _getGraphs(graph) {
    if (!isString(graph)) {
      return this._graphs;
    }
    return {
      [graph]: this._graphs[graph]
    };
  }
  _match(subject, predicate, object, graph) {
    subject = subject && termToId(subject);
    predicate = predicate && termToId(predicate);
    object = object && termToId(object);
    graph = graph && termToId(graph);
    const quads = [];
    const graphs = this._getGraphs(graph);
    const ids = this._ids;
    let content, subjectId, predicateId, objectId;
    if (isString(subject) && !(subjectId = ids[subject]) || isString(predicate) && !(predicateId = ids[predicate]) || isString(object) && !(objectId = ids[object])) {
      return quads;
    }
    for (const graphId in graphs) {
      content = graphs[graphId];
      if (content) {
        if (subjectId) {
          if (objectId) {
            this._findInIndex(content.objects, objectId, subjectId, predicateId, "object", "subject", "predicate", graphId, null, quads);
          } else {
            this._findInIndex(content.subjects, subjectId, predicateId, null, "subject", "predicate", "object", graphId, null, quads);
          }
        } else if (predicateId) {
          this._findInIndex(content.predicates, predicateId, objectId, null, "predicate", "object", "subject", graphId, null, quads);
        } else if (objectId) {
          this._findInIndex(content.objects, objectId, null, null, "object", "subject", "predicate", graphId, null, quads);
        } else {
          this._findInIndex(content.subjects, null, null, null, "subject", "predicate", "object", graphId, null, quads);
        }
      }
    }
    return quads;
  }
  _getQuad(subjectId, predicateId, objectId, graphId) {
    return this._quads.get(this._toId(subjectId, predicateId, objectId, graphId));
  }
  _setQuad(subjectId, predicateId, objectId, graphId, quad2) {
    this._quads.set(this._toId(subjectId, predicateId, objectId, graphId), quad2);
  }
  _deleteQuad(subjectId, predicateId, objectId, graphId) {
    this._quads.delete(this._toId(subjectId, predicateId, objectId, graphId));
  }
  _createDataset(quads) {
    return new this.constructor(quads);
  }
  _toId(subjectId, predicateId, objectId, graphId) {
    return `${subjectId}:${predicateId}:${objectId}:${graphId}`;
  }
};
var DatasetCore_default = DatasetCore;

// ../../node_modules/.pnpm/@rdfjs+dataset@2.0.2/node_modules/@rdfjs/dataset/Factory.js
var Factory = class {
  dataset(quads) {
    return new DatasetCore_default(quads);
  }
};
Factory.exports = ["dataset"];
var Factory_default2 = Factory;

// ../../node_modules/.pnpm/@rdfjs+data-model@2.1.1/node_modules/@rdfjs/data-model/index.js
var factory = new Factory_default();
var data_model_default = factory;

// ../../node_modules/.pnpm/@rdfjs+namespace@2.0.1/node_modules/@rdfjs/namespace/index.js
var handler = {
  apply: (target, thisArg, args) => target(args[0]),
  get: (target, property) => target(property)
};
function namespace(baseIRI, { factory: factory3 = data_model_default } = {}) {
  const builder111 = (term2 = "") => factory3.namedNode(`${baseIRI}${term2.raw || term2}`);
  return typeof Proxy === "undefined" ? builder111 : new Proxy(builder111, handler);
}
var namespace_default = namespace;

// ../../node_modules/.pnpm/@rdfjs+namespace@2.0.1/node_modules/@rdfjs/namespace/Factory.js
var Factory2 = class {
  namespace(baseIRI) {
    return namespace_default(baseIRI, { factory: this });
  }
};
Factory2.exports = ["namespace"];
var Factory_default3 = Factory2;

// ../../node_modules/.pnpm/clownface@2.0.3/node_modules/clownface/lib/namespace.js
var namespace_default2 = (factory3) => {
  const xsd2 = factory3.namespace("http://www.w3.org/2001/XMLSchema#");
  const rdf = factory3.namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
  return {
    first: rdf.first,
    nil: rdf.nil,
    rest: rdf.rest,
    langString: rdf.langString,
    xsd: xsd2
  };
};

// ../../node_modules/.pnpm/clownface@2.0.3/node_modules/clownface/lib/toArray.js
function toArray(value, defaultValue) {
  if (typeof value === "undefined" || value === null) {
    return defaultValue;
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string" && value[Symbol.iterator]) {
    return [...value];
  }
  return [value];
}

// ../../node_modules/.pnpm/clownface@2.0.3/node_modules/clownface/lib/environment.js
var environment_default = new Environment_default([
  Factory_default3,
  Factory_default
]);

// ../../node_modules/.pnpm/clownface@2.0.3/node_modules/clownface/lib/fromPrimitive.js
var { xsd } = namespace_default2(environment_default);
function booleanToLiteral(value, factory3 = environment_default) {
  if (typeof value !== "boolean") {
    return null;
  }
  return factory3.literal(value.toString(), xsd("boolean"));
}
function numberToLiteral(value, factory3 = environment_default) {
  if (typeof value !== "number") {
    return null;
  }
  if (Number.isInteger(value)) {
    return factory3.literal(value.toString(10), xsd("integer"));
  }
  return factory3.literal(value.toString(10), xsd("double"));
}
function stringToLiteral(value, factory3 = environment_default) {
  if (typeof value !== "string") {
    return null;
  }
  return factory3.literal(value);
}
function toLiteral(value, factory3 = environment_default) {
  return booleanToLiteral(value, factory3) || numberToLiteral(value, factory3) || stringToLiteral(value, factory3);
}

// ../../node_modules/.pnpm/clownface@2.0.3/node_modules/clownface/lib/term.js
function blankNode(value, factory3) {
  if (value && typeof value !== "string") {
    throw new Error("Blank node identifier must be a string");
  }
  return factory3.blankNode(value);
}
function literal(value, languageOrDatatype, factory3) {
  if (typeof value === "string") {
    languageOrDatatype = languageOrDatatype && (languageOrDatatype.value || languageOrDatatype.toString());
    if (languageOrDatatype && languageOrDatatype.indexOf(":") !== -1) {
      languageOrDatatype = factory3.namedNode(languageOrDatatype);
    }
    return factory3.literal(value.toString(), languageOrDatatype);
  }
  const term2 = toLiteral(value, factory3);
  if (!term2) {
    throw new Error("The value cannot be converted to a literal node");
  }
  return term2;
}
function namedNode(value, factory3) {
  if (typeof value !== "string") {
    throw new Error("Named node must be an IRI string");
  }
  return factory3.namedNode(value);
}
function term(value, type = "Literal", languageOrDatatype, factory3) {
  if (value && typeof value === "object" && value.termType) {
    return value;
  }
  if (value && value.constructor.name === "URL") {
    return namedNode(value.toString(), factory3);
  }
  if (type === "BlankNode") {
    return blankNode(value, factory3);
  }
  if (value === null || typeof value === "undefined") {
    return void 0;
  }
  if (type === "Literal") {
    return literal(value, languageOrDatatype, factory3);
  }
  if (type === "NamedNode") {
    return namedNode(value, factory3);
  }
  throw new Error("unknown type");
}

// ../../node_modules/.pnpm/clownface@2.0.3/node_modules/clownface/lib/toTermArray.js
function toTermArray(items, type, languageOrDatatype, factory3) {
  if ((typeof items === "undefined" || items === null) && !type) {
    return items;
  }
  return (toArray(items) || [void 0]).reduce((all, item) => {
    if (typeof item === "object" && item.terms) {
      return all.concat(item.terms);
    }
    all.push(term(item, type, languageOrDatatype, factory3));
    return all;
  }, []);
}

// ../../node_modules/.pnpm/clownface@2.0.3/node_modules/clownface/lib/languageTag.js
var ns = namespace_default2(environment_default);
function mapLiteralsByLanguage(map, current) {
  const notLiteral = current.termType !== "Literal";
  const notStringLiteral = ns.langString.equals(current.datatype) || ns.xsd.string.equals(current.datatype);
  if (notLiteral || !notStringLiteral) return map;
  const language = current.language.toLowerCase();
  if (map.has(language)) {
    map.get(language).push(current);
  } else {
    map.set(language, [current]);
  }
  return map;
}
function createLanguageMapper(objects) {
  const literalsByLanguage = objects.reduce(mapLiteralsByLanguage, /* @__PURE__ */ new Map());
  const langMapEntries = [...literalsByLanguage.entries()];
  return (language) => {
    const languageLowerCase = language.toLowerCase();
    if (languageLowerCase === "*") {
      return langMapEntries[0] && langMapEntries[0][1];
    }
    const exactMatch = literalsByLanguage.get(languageLowerCase);
    if (exactMatch) {
      return exactMatch;
    }
    const secondaryMatches = langMapEntries.find(([entryLanguage]) => entryLanguage.startsWith(languageLowerCase));
    return secondaryMatches && secondaryMatches[1];
  };
}
function filterTaggedLiterals(terms, { language }) {
  const languages = typeof language === "string" ? [language] : language;
  const getLiteralsForLanguage = createLanguageMapper(terms);
  return languages.map(getLiteralsForLanguage).find(Boolean) || [];
}

// ../../node_modules/.pnpm/clownface@2.0.3/node_modules/clownface/lib/Context.js
var Context = class _Context {
  constructor({ dataset: dataset2, graph, value, factory: factory3, namespace: namespace2 }) {
    this.dataset = dataset2;
    this.graph = graph;
    this.factory = factory3;
    this.namespace = namespace2;
    this.term = term(value, void 0, void 0, factory3);
  }
  clone({ dataset: dataset2 = this.dataset, graph = this.graph, value, factory: factory3 = this.factory, namespace: namespace2 = this.namespace }) {
    return new _Context({ dataset: dataset2, graph, value, factory: factory3, namespace: namespace2 });
  }
  has(predicate, object) {
    return this.matchProperty(toArray(this.term), predicate, object, toArray(this.graph), "subject").map((subject) => {
      return this.clone({ value: subject });
    });
  }
  in(predicate) {
    return this.matchProperty(null, predicate, toArray(this.term), toArray(this.graph), "subject").map((subject) => {
      return this.clone({ value: subject });
    });
  }
  out(predicate, { language } = {}) {
    let objects = this.matchProperty(toArray(this.term), predicate, null, toArray(this.graph), "object");
    if (typeof language !== "undefined") {
      objects = filterTaggedLiterals(objects, { language });
    }
    return objects.map((object) => {
      return this.clone({ value: object });
    });
  }
  addIn(predicates, subjects) {
    const context = [];
    if (this.term) {
      subjects.forEach((subject) => {
        predicates.forEach((predicate) => {
          this.dataset.add(this.factory.quad(subject, predicate, this.term, this.graph));
        });
        context.push(this.clone({ value: subject }));
      });
    }
    return context;
  }
  addOut(predicates, objects) {
    const context = [];
    if (this.term) {
      objects.forEach((object) => {
        predicates.forEach((predicate) => {
          this.dataset.add(this.factory.quad(this.term, predicate, object, this.graph));
        });
        context.push(this.clone({ value: object }));
      });
    }
    return context;
  }
  addList(predicates, items) {
    if (!this.term) {
      return;
    }
    predicates.forEach((predicate) => {
      const nodes = items.map(() => this.factory.blankNode());
      this.dataset.add(this.factory.quad(this.term, predicate, nodes[0] || this.namespace.nil, this.graph));
      for (let index = 0; index < nodes.length; index++) {
        this.dataset.add(this.factory.quad(nodes[index], this.namespace.first, items[index], this.graph));
        this.dataset.add(this.factory.quad(nodes[index], this.namespace.rest, nodes[index + 1] || this.namespace.nil, this.graph));
      }
    });
  }
  deleteIn(predicate, subject) {
    this.deleteMatch(subject, predicate, toArray(this.term), toArray(this.graph));
  }
  deleteOut(predicate, objects) {
    this.deleteMatch(toArray(this.term), predicate, objects, toArray(this.graph));
  }
  deleteList(predicates) {
    predicates.forEach((predicate) => {
      for (const quad2 of this.dataset.match(this.term, predicate)) {
        this.deleteItems(quad2);
      }
    });
  }
  deleteItems(start) {
    let quads = [start];
    while (!quads[quads.length - 1].object.equals(this.namespace.nil)) {
      const node = quads[quads.length - 1].object;
      quads = quads.concat([...this.dataset.match(node)]);
    }
    quads.forEach((quad2) => {
      this.dataset.delete(quad2);
    });
  }
  match(subject, predicate, object, graph) {
    if (!subject && !predicate && !object && !graph) {
      return [...this.dataset];
    }
    subject = subject || [null];
    predicate = predicate || [null];
    object = object || [null];
    graph = graph || [null];
    const matches = [];
    for (const g of graph) {
      for (const s of subject) {
        for (const p of predicate) {
          for (const o of object) {
            for (const quad2 of this.dataset.match(s, p, o, g)) {
              matches.push(quad2);
            }
          }
        }
      }
    }
    return matches;
  }
  matchProperty(subject, predicate, object, graph, property) {
    return this.match(subject, predicate, object, graph).map((quad2) => quad2[property]);
  }
  deleteMatch(subject, predicate, object, graph) {
    this.match(subject, predicate, object, graph).forEach((quad2) => {
      this.dataset.delete(quad2);
    });
  }
};

// ../../node_modules/.pnpm/clownface@2.0.3/node_modules/clownface/lib/Clownface.js
var Clownface = class _Clownface {
  constructor({ dataset: dataset2, graph, term: term2, value, factory: factory3, _context }) {
    this.factory = factory3;
    this.namespace = namespace_default2(factory3);
    if (_context) {
      this._context = _context;
      return;
    }
    const terms = term2 && toArray(term2) || value && toArray(value) || [null];
    this._context = terms.map((term3) => {
      return new Context({ dataset: dataset2, graph, value: term3, factory: this.factory, namespace: this.namespace });
    });
  }
  /**
   * Gets the current RDF/JS term or undefined if pointer has no context
   *
   * @returns {undefined|Term}
   */
  get term() {
    const terms = this.terms;
    if (terms.length !== 1) {
      return void 0;
    }
    return terms[0];
  }
  /**
   * Gets the current terms or an empty array if the pointer has no context
   *
   * @returns {Term[]}
   */
  get terms() {
    return this._context.map((node) => node.term).filter(Boolean);
  }
  /**
   * Gets the string representation of term
   *
   * @returns {undefined|string}
   */
  get value() {
    const term2 = this.term;
    return term2 && term2.value;
  }
  /**
   * Gets the string representation of terms
   *
   * @returns {string[]}
   */
  get values() {
    return this.terms.map((term2) => term2.value);
  }
  /**
   * Gets the current context's dataset, or undefined if there are multiple
   *
   * @returns {undefined|DatasetCore}
   */
  get dataset() {
    const datasets = this.datasets;
    if (datasets.length !== 1) {
      return void 0;
    }
    return datasets[0];
  }
  /**
   * Gets the current context's datasets
   *
   * @returns {DatasetCore[]}
   */
  get datasets() {
    return this._context.map((node) => node.dataset).filter(Boolean);
  }
  /**
   * Removes current pointers from the context and return an "any pointer".
   * The returned object can be used to find any nodes in the dataset
   *
   * @returns {Clownface}
   */
  any() {
    return _Clownface.fromContext(this._context.map((current) => current.clone({})), this);
  }
  /**
   * Returns true if the current term is a rdf:List
   *
   * @returns {boolean}
   */
  isList() {
    if (!this.term) {
      return false;
    }
    if (this.term.equals(this.namespace.nil)) {
      return true;
    }
    if (this.out(this.namespace.first).term) {
      return true;
    }
    return false;
  }
  /**
   * Creates an iterator which iterates and rdf:List of the current term
   *
   * @returns {Iterable | null}
   */
  list() {
    if (this.terms.length > 1) {
      throw new Error("iterator over multiple terms is not supported");
    }
    if (this.term) {
      if (this.term.termType !== "NamedNode" && this.term.termType !== "BlankNode") {
        return null;
      }
      if (!this.term.equals(this.namespace.nil) && !this.out(this.namespace.first).term) {
        return null;
      }
    }
    let item = this;
    return {
      [Symbol.iterator]: () => {
        return {
          next: () => {
            if (!item.term || item.term.equals(this.namespace.nil)) {
              return { done: true };
            }
            const value = item.out(this.namespace.first);
            if (value.terms.length > 1) {
              throw new Error(`Invalid list: multiple values for rdf:first on ${item.value}`);
            }
            const rest = item.out(this.namespace.rest);
            if (rest.terms.length > 1) {
              throw new Error(`Invalid list: multiple values for rdf:rest on ${item.value}`);
            }
            item = rest;
            return { done: false, value };
          }
        };
      }
    };
  }
  /**
   * Returns an array of graph pointers where each one has a single _context
   *
   * @returns {Clownface[]}
   */
  toArray() {
    return this._context.map((context) => _Clownface.fromContext(context, this)).filter((context) => context.terms.some(Boolean));
  }
  /**
   * Returns graph pointers which meet the condition specified in a callback function
   * @param {FilterCallback} callback
   * @returns {Clownface}
   */
  filter(callback) {
    const pointers = this._context.map((context) => _Clownface.fromContext(context, this));
    return _Clownface.fromContext(this._context.filter((context, index) => callback(_Clownface.fromContext(context, this), index, pointers)), this);
  }
  /**
   * Performs the specified action on every graph pointer
   * @param {ForEachCallback} callback
   * @returns {Clownface}
   */
  forEach(callback) {
    this.toArray().forEach(callback);
    return this;
  }
  /**
   * Calls a defined callback function on each graph pointer, and returns an array that contains the results.
   * @template T
   * @param {MapCallback<T>} callback
   * @returns {T[]}
   */
  map(callback) {
    return this.toArray().map(callback);
  }
  toString() {
    return this.values.join();
  }
  /**
   * Creates graph pointer to one or more node(s)
   *
   * Depending on the value creates pointers to:
   *
   * - blank node context for null `values`
   * - literal for string `values` and no `options` paramter
   * - matching RDF/JS term
   * - term created according to `options.type` parameter
   *
   * @param {null|string|string[]|Term|Term[]|Clownface|Clownface[]} values
   * @param {Object} [options]
   * @param {"NamedNode"|"BlankNode"|"Literal"} [options.type] explicit type for nodes
   * @param {string} [options.language] language tag of literals
   * @param {string} [options.datatype] datatype of literals
   * @returns {Clownface}
   */
  node(values, { type, datatype, language } = {}) {
    values = this._toTermArray(values, type, datatype || language) || [null];
    const context = values.reduce((context2, value) => {
      return context2.concat(this._context.reduce((all, current) => {
        return all.concat([current.clone({ value })]);
      }, []));
    }, []);
    return _Clownface.fromContext(context, { factory: this.factory });
  }
  /**
   * Creates graph pointer to one or more blank nodes
   * @param {null|string|string[]|BlankNode|BlankNode[]|Clownface|Clownface[]} [values] blank node identifiers (generates it when falsy) or existing RDF/JS blank node(s)
   * @returns {Clownface}
   */
  blankNode(values) {
    return this.node(values, { type: "BlankNode" });
  }
  /**
   * Creates graph pointer to one or more literal nodes
   * @param {string|string[]|boolean|boolean[]|number|number[]|Literal|Literal[]|Clownface|Clownface[]} values literal values as JS objects or RDF/JS Literal(s)
   * @param {string|Term} [languageOrDatatype] a language tag string or datatype term
   * @returns {Clownface}
   */
  literal(values, languageOrDatatype) {
    return this.node(values, { type: "Literal", datatype: languageOrDatatype });
  }
  /**
   * Creates graph pointer to one or more named nodes
   * @param {string|string[]|NamedNode|NamedNode[]|Clownface|Clownface[]} values URI(s) or RDF/JS NamedNode(s)
   * @returns {Clownface}
   */
  namedNode(values) {
    return this.node(values, { type: "NamedNode" });
  }
  /**
   * Creates a graph pointer to nodes which are linked to the current pointer by `predicates`
   * @param {Term|Term[]|Clownface|Clownface[]} [predicates] one or more RDF/JS term identifying a property
   * @returns {Clownface}
   */
  in(predicates) {
    predicates = this._toTermArray(predicates);
    const context = this._context.reduce((all, current) => all.concat(current.in(predicates)), []);
    return _Clownface.fromContext(context, this);
  }
  /**
   * Creates a graph pointer to the result nodes after following a predicate, or after
   * following any predicates in an array, starting from the subject(s) (current graph pointer) to the objects.
   * @param {Term|Term[]|Clownface|Clownface[]} [predicates] any predicates to follow
   * @param {object} [options]
   * @param {string | string[] | undefined} [options.language]
   * @returns {Clownface}
   */
  out(predicates, options = {}) {
    predicates = this._toTermArray(predicates);
    const context = this._context.reduce((all, current) => all.concat(current.out(predicates, options)), []);
    return _Clownface.fromContext(context, this);
  }
  /**
   * Creates a graph pointer to nodes which are subjects of predicates, optionally also with specific objects
   *
   * If the current context is empty, will check all potential subjects
   *
   * @param {Term|Term[]|Clownface|Clownface[]} predicates RDF property identifiers
   * @param {*} [objects] object values to match
   * @returns {Clownface}
   */
  has(predicates, objects) {
    predicates = this._toTermArray(predicates);
    objects = this._toTermArray(objects);
    const context = this._context.reduce((all, current) => all.concat(current.has(predicates, objects)), []);
    return _Clownface.fromContext(context, this);
  }
  /**
   * Creates a new quad(s) in the dataset where the current context is the object
   *
   * @param {Term|Term[]|Clownface|Clownface[]} predicates
   * @param {NamedNode|NamedNode[]|Clownface|Clownface[]} subjects one or more nodes to use as subjects
   * @param {GraphPointerCallback} [callback] called for each object, with subject pointer as parameter
   * @returns {Clownface} current graph pointer
   */
  addIn(predicates, subjects, callback) {
    if (!predicates) {
      throw new Error("predicate parameter is required");
    }
    if (typeof subjects === "function") {
      callback = subjects;
      subjects = null;
    }
    predicates = this._toTermArray(predicates);
    subjects = this._toTermArray(subjects) || [this.factory.blankNode()];
    const context = this._context.map((context2) => context2.addIn(predicates, subjects));
    if (callback) {
      _Clownface.fromContext(context, this).forEach(callback);
    }
    return this;
  }
  /**
   * Creates a new quad(s) in the dataset where the current context is the subject
   *
   * @param {Term|Term[]|Clownface|Clownface[]} predicates
   * @param {*} objects one or more values to use for objects
   * @param {GraphPointerCallback} [callback] called for each subject, with object pointer as parameter
   * @returns {Clownface} current graph pointer
   */
  addOut(predicates, objects, callback) {
    if (!predicates) {
      throw new Error("predicate parameter is required");
    }
    if (typeof objects === "function") {
      callback = objects;
      objects = null;
    }
    predicates = this._toTermArray(predicates);
    objects = this._toTermArray(objects) || [this.factory.blankNode()];
    const context = this._context.map((context2) => context2.addOut(predicates, objects));
    if (callback) {
      _Clownface.fromContext(context, this).forEach(callback);
    }
    return this;
  }
  /**
   * Creates a new RDF list or lists containing the given items
   *
   * @param {Term|Term[]|Clownface|Clownface[]} predicates
   * @param {*} items one or more values to use for subjects
   * @returns {Clownface} current graph pointer
   */
  addList(predicates, items) {
    if (!predicates || !items) {
      throw new Error("predicate and items parameter is required");
    }
    predicates = this._toTermArray(predicates);
    items = this._toTermArray(items);
    this._context.forEach((context) => context.addList(predicates, items));
    return this;
  }
  /**
   * Deletes all quads where the current graph pointer contexts are the objects
   *
   * @param {Term|Term[]|Clownface|Clownface[]} [predicates]
   * @param {Term|Term[]|Clownface|Clownface[]} [subjects]
   * @returns {Clownface} current graph pointer
   */
  deleteIn(predicates, subjects) {
    predicates = this._toTermArray(predicates);
    subjects = this._toTermArray(subjects);
    this._context.forEach((context) => context.deleteIn(predicates, subjects));
    return this;
  }
  /**
   * Deletes all quads where the current graph pointer contexts are the subjects
   *
   * @param {Term|Term[]|Clownface|Clownface[]} [predicates]
   * @param {Term|Term[]|Clownface|Clownface[]} [objects]
   * @returns {Clownface} current graph pointer
   */
  deleteOut(predicates, objects) {
    predicates = this._toTermArray(predicates);
    objects = this._toTermArray(objects);
    this._context.forEach((context) => context.deleteOut(predicates, objects));
    return this;
  }
  /**
   * Deletes entire RDF lists where the current graph pointer is the subject
   *
   * @param {Term|Term[]|Clownface|Clownface[]} predicates
   * @returns {Clownface} current graph pointer
   */
  deleteList(predicates) {
    if (!predicates) {
      throw new Error("predicate parameter is required");
    }
    predicates = this._toTermArray(predicates);
    this._context.forEach((context) => context.deleteList(predicates));
    return this;
  }
  _toTermArray(predicates, type, languageOrDatatype) {
    return toTermArray(predicates, type, languageOrDatatype, this.factory);
  }
  static fromContext(context, { factory: factory3 }) {
    return new _Clownface({ _context: toArray(context), factory: factory3 });
  }
};

// ../../node_modules/.pnpm/clownface@2.0.3/node_modules/clownface/index.js
function factory2({ dataset: dataset2, graph, term: term2, value, factory: factory3 = environment_default, _context }) {
  return new Clownface({ dataset: dataset2, graph, term: term2, value, factory: factory3, _context });
}

// ../../node_modules/.pnpm/clownface@2.0.3/node_modules/clownface/Factory.js
var ClownfaceFactory = class {
  clownface({ ...args } = {}) {
    if (!args.dataset && typeof this.dataset === "function") {
      args.dataset = this.dataset();
    }
    return factory2({ ...args, factory: this });
  }
};
ClownfaceFactory.exports = ["clownface"];
var Factory_default4 = ClownfaceFactory;

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/defaultEnv.js
var defaultEnv_default = new Environment_default([
  Factory_default,
  Factory_default2,
  Factory_default3,
  Factory_default4
]);

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/namespaces.js
function prepareNamespaces(factory3) {
  return {
    sh: namespace_default("http://www.w3.org/ns/shacl#", { factory: factory3 }),
    xsd: namespace_default("http://www.w3.org/2001/XMLSchema#", { factory: factory3 }),
    rdf: namespace_default("http://www.w3.org/1999/02/22-rdf-syntax-ns#", { factory: factory3 }),
    rdfs: namespace_default("http://www.w3.org/2000/01/rdf-schema#", { factory: factory3 })
  };
}
var namespaces_default = prepareNamespaces();

// ../../node_modules/.pnpm/@vocabulary+sh@1.1.6_@rdfjs+types@1.1.2/node_modules/@vocabulary/sh/index.js
var sh_default = ({ factory: factory3 }) => {
  const f = factory3;
  const ns1 = "http://www.w3.org/ns/shacl#";
  const ns2 = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  const ns3 = "http://www.w3.org/2002/07/owl#";
  const ns4 = "http://www.w3.org/2000/01/rdf-schema#";
  const ns5 = "http://www.w3.org/ns/shacl-shacl#";
  const ns6 = "http://www.w3.org/2001/XMLSchema#";
  const ns7 = "http://datashapes.org/dash#";
  const blankNodes = [];
  for (let i = 0; i < 76; i++) {
    blankNodes.push(f.blankNode());
  }
  return [
    f.quad(f.namedNode(ns1), f.namedNode(`${ns2}type`), f.namedNode(`${ns3}Ontology`), f.namedNode(ns1)),
    f.quad(f.namedNode(ns1), f.namedNode(`${ns4}comment`), f.literal("This vocabulary defines terms used in SHACL, the W3C Shapes Constraint Language.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(ns1), f.namedNode(`${ns4}label`), f.literal("W3C Shapes Constraint Language (SHACL) Vocabulary", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(ns1), f.namedNode(`${ns1}declare`), blankNodes[0], f.namedNode(ns1)),
    f.quad(f.namedNode(ns1), f.namedNode(`${ns1}suggestedShapesGraph`), f.namedNode(ns5), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AbstractResult`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AbstractResult`), f.namedNode(`${ns4}comment`), f.literal("The base class of validation results, typically not instantiated directly.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AbstractResult`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AbstractResult`), f.namedNode(`${ns4}label`), f.literal("Abstract result", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AbstractResult`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AndConstraintComponent-and`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AndConstraintComponent-and`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AndConstraintComponent-and`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}and`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AndConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AndConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to test whether a value node conforms to all members of a provided list of shapes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AndConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AndConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("And constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}AndConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}AndConstraintComponent-and`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNode`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeKind`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNode`), f.namedNode(`${ns4}comment`), f.literal("The node kind of all blank nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNode`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNode`), f.namedNode(`${ns4}label`), f.literal("Blank node", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNodeOrIRI`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeKind`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNodeOrIRI`), f.namedNode(`${ns4}comment`), f.literal("The node kind of all blank nodes or IRIs.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNodeOrIRI`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNodeOrIRI`), f.namedNode(`${ns4}label`), f.literal("Blank node or IRI", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNodeOrLiteral`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeKind`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNodeOrLiteral`), f.namedNode(`${ns4}comment`), f.literal("The node kind of all blank nodes or literals.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNodeOrLiteral`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}BlankNodeOrLiteral`), f.namedNode(`${ns4}label`), f.literal("Blank node or literal", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClassConstraintComponent-class`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClassConstraintComponent-class`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClassConstraintComponent-class`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}IRI`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClassConstraintComponent-class`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClassConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClassConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that each value node is an instance of a given type.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClassConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClassConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Class constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClassConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}ClassConstraintComponent-class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent-closed`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent-closed`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent-closed`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent-closed`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}closed`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent-ignoredProperties`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent-ignoredProperties`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent-ignoredProperties`), f.namedNode(`${ns1}optional`), f.literal("true", f.namedNode(`${ns6}boolean`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent-ignoredProperties`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}ignoredProperties`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to indicate that focus nodes must only have values for those properties that have been explicitly enumerated via sh:property/sh:path.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Closed constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}ClosedConstraintComponent-closed`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ClosedConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}ClosedConstraintComponent-ignoredProperties`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("The class of constraint components.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Parameterizable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}CountExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}CountExpression`), f.namedNode(`${ns4}comment`), f.literal("A count expression is a blank node with exactly one value for the property sh:count which is a well-formed node expression."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}CountExpression`), f.namedNode(`${ns4}label`), f.literal("Count Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}CountExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}CountExpression`), f.namedNode(`${ns1}property`), blankNodes[1], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}CountExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}count`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DatatypeConstraintComponent-datatype`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DatatypeConstraintComponent-datatype`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DatatypeConstraintComponent-datatype`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DatatypeConstraintComponent-datatype`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}IRI`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DatatypeConstraintComponent-datatype`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}datatype`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DatatypeConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DatatypeConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the datatype of all value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DatatypeConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DatatypeConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Datatype constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DatatypeConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}DatatypeConstraintComponent-datatype`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DisjointConstraintComponent-disjoint`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DisjointConstraintComponent-disjoint`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DisjointConstraintComponent-disjoint`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}IRI`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DisjointConstraintComponent-disjoint`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}disjoint`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DisjointConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DisjointConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that the set of value nodes is disjoint with the the set of nodes that have the focus node as subject and the value of a given property as predicate.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DisjointConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DisjointConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Disjoint constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DisjointConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}DisjointConstraintComponent-disjoint`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DistinctExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DistinctExpression`), f.namedNode(`${ns4}comment`), f.literal("A distinct expression is a blank node with exactly one value for the property sh:distinct which is a well-formed node expression."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DistinctExpression`), f.namedNode(`${ns4}label`), f.literal("Distinct Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DistinctExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DistinctExpression`), f.namedNode(`${ns1}property`), blankNodes[2], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}DistinctExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}distinct`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}EqualsConstraintComponent-equals`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}EqualsConstraintComponent-equals`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}EqualsConstraintComponent-equals`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}IRI`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}EqualsConstraintComponent-equals`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}equals`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}EqualsConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}EqualsConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that the set of value nodes is equal to the set of nodes that have the focus node as subject and the value of a given property as predicate.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}EqualsConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}EqualsConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Equals constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}EqualsConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}EqualsConstraintComponent-equals`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExistsExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExistsExpression`), f.namedNode(`${ns4}comment`), f.literal("An exists expression is a blank node with exactly one value for sh:exists (which is a well-formed shape)."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExistsExpression`), f.namedNode(`${ns4}label`), f.literal("Exists Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExistsExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExistsExpression`), f.namedNode(`${ns1}property`), blankNodes[3], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExistsExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}exists`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExpressionConstraintComponent-expression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExpressionConstraintComponent-expression`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExpressionConstraintComponent-expression`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}expression`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExpressionConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExpressionConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that a given node expression produces true for all value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExpressionConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExpressionConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Expression constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ExpressionConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}ExpressionConstraintComponent-expression`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FilterShapeExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FilterShapeExpression`), f.namedNode(`${ns4}comment`), f.literal("A filter shape expression is a blank node with exactly one value for sh:filterShape (which is a well-formed shape) and at most one value for sh:nodes (which is a well-formed node expression)."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FilterShapeExpression`), f.namedNode(`${ns4}label`), f.literal("Filter Shape Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FilterShapeExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FilterShapeExpression`), f.namedNode(`${ns1}property`), blankNodes[4], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FilterShapeExpression`), f.namedNode(`${ns1}property`), blankNodes[5], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FilterShapeExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}filterShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FocusNodeOrConstantTermExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FocusNodeOrConstantTermExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}IRIOrLiteral`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Function`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Function`), f.namedNode(`${ns4}comment`), f.literal("The class of SHACL functions.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Function`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Function`), f.namedNode(`${ns4}label`), f.literal("Function", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Function`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Parameterizable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FunctionExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FunctionExpression`), f.namedNode(`${ns4}comment`), f.literal("A function expression is a blank node that does not fulfill any of the syntax rules of the other node expression types and which is the subject of exactly one triple T where the object is a well-formed SHACL list, and each member of that list is a well-formed node expression."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FunctionExpression`), f.namedNode(`${ns4}label`), f.literal("Function Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}FunctionExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}GroupConcatExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}GroupConcatExpression`), f.namedNode(`${ns4}comment`), f.literal("A group concat expression is a blank node with exactly one value for the property sh:groupConcat which is a well-formed node expression. A group concat expression can have a single value for the property sh:separator which is literal with datatype xsd:string."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}GroupConcatExpression`), f.namedNode(`${ns4}label`), f.literal("Group Concat Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}GroupConcatExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}GroupConcatExpression`), f.namedNode(`${ns1}property`), blankNodes[6], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}GroupConcatExpression`), f.namedNode(`${ns1}property`), blankNodes[7], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}GroupConcatExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}groupConcat`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}HasValueConstraintComponent-hasValue`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}HasValueConstraintComponent-hasValue`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}HasValueConstraintComponent-hasValue`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}hasValue`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}HasValueConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}HasValueConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that one of the value nodes is a given RDF node.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}HasValueConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}HasValueConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Has-value constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}HasValueConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}HasValueConstraintComponent-hasValue`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IRI`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeKind`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IRI`), f.namedNode(`${ns4}comment`), f.literal("The node kind of all IRIs.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IRI`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IRI`), f.namedNode(`${ns4}label`), f.literal("IRI", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IRIOrLiteral`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeKind`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IRIOrLiteral`), f.namedNode(`${ns4}comment`), f.literal("The node kind of all IRIs or literals.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IRIOrLiteral`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IRIOrLiteral`), f.namedNode(`${ns4}label`), f.literal("IRI or literal", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IfExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IfExpression`), f.namedNode(`${ns4}comment`), f.literal("An if expression is a blank node with exactly one value for sh:if (which is a well-formed node expression), at most one value for sh:then (which is a well-formed node expression) and at most one value for sh:else (which is a well-formed node expression)."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IfExpression`), f.namedNode(`${ns4}label`), f.literal("If Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IfExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IfExpression`), f.namedNode(`${ns1}property`), blankNodes[8], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IfExpression`), f.namedNode(`${ns1}property`), blankNodes[9], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IfExpression`), f.namedNode(`${ns1}property`), blankNodes[10], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IfExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}else`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IfExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}if`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IfExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}then`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}InConstraintComponent-in`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}InConstraintComponent-in`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}InConstraintComponent-in`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}InConstraintComponent-in`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}in`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}InConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}InConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to exclusively enumerate the permitted value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}InConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}InConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("In constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}InConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}InConstraintComponent-in`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Info`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Severity`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Info`), f.namedNode(`${ns4}comment`), f.literal("The severity for an informational validation result.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Info`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Info`), f.namedNode(`${ns4}label`), f.literal("Info", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IntersectionExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IntersectionExpression`), f.namedNode(`${ns4}comment`), f.literal("An intersection expression is a blank node with exactly one value for the property sh:intersection which is a well-formed SHACL list with at least two members (which are well-formed node expressions)."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IntersectionExpression`), f.namedNode(`${ns4}label`), f.literal("Intersection Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IntersectionExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IntersectionExpression`), f.namedNode(`${ns1}property`), blankNodes[11], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}IntersectionExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}intersection`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraint-js`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraint-js`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraint-js`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}js`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraint`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraint`), f.namedNode(`${ns4}comment`), f.literal("The class of constraints backed by a JavaScript function.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraint`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraint`), f.namedNode(`${ns4}label`), f.literal("JavaScript-based constraint", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraint`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}JSExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component with the parameter sh:js linking to a sh:JSConstraint containing a sh:script.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("JavaScript constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}JSConstraint-js`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSExecutable`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSExecutable`), f.namedNode(`${ns4}comment`), f.literal("Abstract base class of resources that declare an executable JavaScript.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSExecutable`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSExecutable`), f.namedNode(`${ns4}label`), f.literal("JavaScript executable", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSExecutable`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSFunction`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSFunction`), f.namedNode(`${ns4}comment`), f.literal("The class of SHACL functions that execute a JavaScript function when called.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSFunction`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSFunction`), f.namedNode(`${ns4}label`), f.literal("JavaScript function", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSFunction`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Function`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSFunction`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}JSExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSLibrary`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSLibrary`), f.namedNode(`${ns4}comment`), f.literal("Represents a JavaScript library, typically identified by one or more URLs of files to include.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSLibrary`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSLibrary`), f.namedNode(`${ns4}label`), f.literal("JavaScript library", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSLibrary`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSRule`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSRule`), f.namedNode(`${ns4}comment`), f.literal("The class of SHACL rules expressed using JavaScript.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSRule`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSRule`), f.namedNode(`${ns4}label`), f.literal("JavaScript rule", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSRule`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}JSExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSRule`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Rule`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTarget`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTarget`), f.namedNode(`${ns4}comment`), f.literal("The class of targets that are based on JavaScript functions.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTarget`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTarget`), f.namedNode(`${ns4}label`), f.literal("JavaScript target", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTarget`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}JSExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTarget`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Target`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTargetType`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTargetType`), f.namedNode(`${ns4}comment`), f.literal("The (meta) class for parameterizable targets that are based on JavaScript functions.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTargetType`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTargetType`), f.namedNode(`${ns4}label`), f.literal("JavaScript target type", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTargetType`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}JSExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSTargetType`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}TargetType`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSValidator`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSValidator`), f.namedNode(`${ns4}comment`), f.literal("A SHACL validator based on JavaScript. This can be used to declare SHACL constraint components that perform JavaScript-based validation when used.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSValidator`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSValidator`), f.namedNode(`${ns4}label`), f.literal("JavaScript validator", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSValidator`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}JSExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}JSValidator`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Validator`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LanguageInConstraintComponent-languageIn`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LanguageInConstraintComponent-languageIn`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LanguageInConstraintComponent-languageIn`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LanguageInConstraintComponent-languageIn`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}languageIn`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LanguageInConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LanguageInConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to enumerate language tags that all value nodes must have.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LanguageInConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LanguageInConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Language-in constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LanguageInConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}LanguageInConstraintComponent-languageIn`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanConstraintComponent-lessThan`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanConstraintComponent-lessThan`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanConstraintComponent-lessThan`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}IRI`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanConstraintComponent-lessThan`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}lessThan`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that each value node is smaller than all the nodes that have the focus node as subject and the value of a given property as predicate.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Less-than constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}LessThanConstraintComponent-lessThan`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanOrEqualsConstraintComponent-lessThanOrEquals`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanOrEqualsConstraintComponent-lessThanOrEquals`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanOrEqualsConstraintComponent-lessThanOrEquals`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}IRI`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanOrEqualsConstraintComponent-lessThanOrEquals`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}lessThanOrEquals`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanOrEqualsConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanOrEqualsConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that every value node is smaller than all the nodes that have the focus node as subject and the value of a given property as predicate.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanOrEqualsConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanOrEqualsConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("less-than-or-equals constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LessThanOrEqualsConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}LessThanOrEqualsConstraintComponent-lessThanOrEquals`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LimitExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LimitExpression`), f.namedNode(`${ns4}comment`), f.literal("A limit expression is a blank node with exactly one value for the property sh:limit which is a literal with datatype xsd:integer and with exactly one value for the property sh:nodes which is a well-formed node expression."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LimitExpression`), f.namedNode(`${ns4}label`), f.literal("Limit Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LimitExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LimitExpression`), f.namedNode(`${ns1}property`), blankNodes[12], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LimitExpression`), f.namedNode(`${ns1}property`), blankNodes[13], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}LimitExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}limit`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Literal`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeKind`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Literal`), f.namedNode(`${ns4}comment`), f.literal("The node kind of all literals.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Literal`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Literal`), f.namedNode(`${ns4}label`), f.literal("Literal", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxCountConstraintComponent-maxCount`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxCountConstraintComponent-maxCount`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxCountConstraintComponent-maxCount`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxCountConstraintComponent-maxCount`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxCountConstraintComponent-maxCount`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}maxCount`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxCountConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxCountConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the maximum number of value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxCountConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxCountConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Max-count constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxCountConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}MaxCountConstraintComponent-maxCount`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExclusiveConstraintComponent-maxExclusive`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExclusiveConstraintComponent-maxExclusive`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExclusiveConstraintComponent-maxExclusive`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExclusiveConstraintComponent-maxExclusive`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}Literal`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExclusiveConstraintComponent-maxExclusive`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}maxExclusive`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExclusiveConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExclusiveConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the range of value nodes with a maximum exclusive value.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExclusiveConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExclusiveConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Max-exclusive constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExclusiveConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}MaxExclusiveConstraintComponent-maxExclusive`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExpression`), f.namedNode(`${ns4}comment`), f.literal("A max expression is a blank node with exactly one value for the property sh:max which is a well-formed node expression."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExpression`), f.namedNode(`${ns4}label`), f.literal("Max Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExpression`), f.namedNode(`${ns1}property`), blankNodes[14], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}max`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxInclusiveConstraintComponent-maxInclusive`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxInclusiveConstraintComponent-maxInclusive`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxInclusiveConstraintComponent-maxInclusive`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxInclusiveConstraintComponent-maxInclusive`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}Literal`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxInclusiveConstraintComponent-maxInclusive`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}maxInclusive`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxInclusiveConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxInclusiveConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the range of value nodes with a maximum inclusive value.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxInclusiveConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxInclusiveConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Max-inclusive constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxInclusiveConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}MaxInclusiveConstraintComponent-maxInclusive`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxLengthConstraintComponent-maxLength`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxLengthConstraintComponent-maxLength`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxLengthConstraintComponent-maxLength`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxLengthConstraintComponent-maxLength`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxLengthConstraintComponent-maxLength`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}maxLength`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxLengthConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxLengthConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the maximum string length of value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxLengthConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxLengthConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Max-length constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MaxLengthConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}MaxLengthConstraintComponent-maxLength`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinCountConstraintComponent-minCount`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinCountConstraintComponent-minCount`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinCountConstraintComponent-minCount`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinCountConstraintComponent-minCount`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinCountConstraintComponent-minCount`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}minCount`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinCountConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinCountConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the minimum number of value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinCountConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinCountConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Min-count constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinCountConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}MinCountConstraintComponent-minCount`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExclusiveConstraintComponent-minExclusive`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExclusiveConstraintComponent-minExclusive`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExclusiveConstraintComponent-minExclusive`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExclusiveConstraintComponent-minExclusive`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}Literal`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExclusiveConstraintComponent-minExclusive`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}minExclusive`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExclusiveConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExclusiveConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the range of value nodes with a minimum exclusive value.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExclusiveConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExclusiveConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Min-exclusive constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExclusiveConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}MinExclusiveConstraintComponent-minExclusive`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExpression`), f.namedNode(`${ns4}comment`), f.literal("A min expression is a blank node with exactly one value for the property sh:min which is a well-formed node expression."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExpression`), f.namedNode(`${ns4}label`), f.literal("Min Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExpression`), f.namedNode(`${ns1}property`), blankNodes[15], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}min`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinInclusiveConstraintComponent-minInclusive`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinInclusiveConstraintComponent-minInclusive`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinInclusiveConstraintComponent-minInclusive`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinInclusiveConstraintComponent-minInclusive`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}Literal`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinInclusiveConstraintComponent-minInclusive`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}minInclusive`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinInclusiveConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinInclusiveConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the range of value nodes with a minimum inclusive value.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinInclusiveConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinInclusiveConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Min-inclusive constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinInclusiveConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}MinInclusiveConstraintComponent-minInclusive`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinLengthConstraintComponent-minLength`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinLengthConstraintComponent-minLength`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinLengthConstraintComponent-minLength`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinLengthConstraintComponent-minLength`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinLengthConstraintComponent-minLength`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}minLength`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinLengthConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinLengthConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the minimum string length of value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinLengthConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinLengthConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Min-length constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinLengthConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}MinLengthConstraintComponent-minLength`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinusExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinusExpression`), f.namedNode(`${ns4}comment`), f.literal("A minus expression is a blank node with exactly one value for the property sh:minus which is a well-formed node expression and exactly one value for the property sh:nodes which is a well-formed node expression."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinusExpression`), f.namedNode(`${ns4}label`), f.literal("Minus Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinusExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinusExpression`), f.namedNode(`${ns1}property`), blankNodes[16], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinusExpression`), f.namedNode(`${ns1}property`), blankNodes[17], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}MinusExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}minus`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeConstraintComponent-node`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeConstraintComponent-node`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeConstraintComponent-node`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}node`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that all value nodes conform to the given node shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Node constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}NodeConstraintComponent-node`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeExpression`), f.namedNode(`${ns1}targetObjectsOf`), f.namedNode(`${ns1}expression`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeExpression`), f.namedNode(`${ns1}targetObjectsOf`), f.namedNode(`${ns1}values`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeExpression`), f.namedNode(`${ns1}xone`), blankNodes[18], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKind`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKind`), f.namedNode(`${ns4}comment`), f.literal("The class of all node kinds, including sh:BlankNode, sh:IRI, sh:Literal or the combinations of these: sh:BlankNodeOrIRI, sh:BlankNodeOrLiteral, sh:IRIOrLiteral.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKind`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKind`), f.namedNode(`${ns4}label`), f.literal("Node kind", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKind`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKindConstraintComponent-nodeKind`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKindConstraintComponent-nodeKind`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKindConstraintComponent-nodeKind`), f.namedNode(`${ns1}in`), blankNodes[19], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKindConstraintComponent-nodeKind`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKindConstraintComponent-nodeKind`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}nodeKind`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKindConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKindConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the RDF node kind of each value node.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKindConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKindConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Node-kind constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeKindConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}NodeKindConstraintComponent-nodeKind`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeShape`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeShape`), f.namedNode(`${ns4}comment`), f.literal("A node shape is a shape that specifies constraint that need to be met with respect to focus nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeShape`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeShape`), f.namedNode(`${ns4}label`), f.literal("Node shape", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NodeShape`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NotConstraintComponent-not`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NotConstraintComponent-not`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NotConstraintComponent-not`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}not`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NotConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NotConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that value nodes do not conform to a given shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NotConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NotConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Not constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}NotConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}NotConstraintComponent-not`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OffsetExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OffsetExpression`), f.namedNode(`${ns4}comment`), f.literal("An offset expression is a blank node with exactly one value for the property sh:offset which is a literal with datatype xsd:integer and with exactly one value for the property sh:nodes which is a well-formed node expression."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OffsetExpression`), f.namedNode(`${ns4}label`), f.literal("Offset Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OffsetExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OffsetExpression`), f.namedNode(`${ns1}property`), blankNodes[20], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OffsetExpression`), f.namedNode(`${ns1}property`), blankNodes[21], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OffsetExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}offset`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrConstraintComponent-or`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrConstraintComponent-or`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrConstraintComponent-or`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}or`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the value nodes so that they conform to at least one out of several provided shapes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Or constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}OrConstraintComponent-or`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrderByExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrderByExpression`), f.namedNode(`${ns4}comment`), f.literal("An orderBy expression is a blank node with exactly one value for the property sh:orderBy which is a well-formed node expression and with exactly one value for the property sh:nodes which is a well-formed node expression. An orderBy expression can have one value for the property sh:desc which is either true or false."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrderByExpression`), f.namedNode(`${ns4}label`), f.literal("OrderBy Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrderByExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrderByExpression`), f.namedNode(`${ns1}property`), blankNodes[22], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrderByExpression`), f.namedNode(`${ns1}property`), blankNodes[23], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrderByExpression`), f.namedNode(`${ns1}property`), blankNodes[24], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}OrderByExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}orderBy`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Parameter`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Parameter`), f.namedNode(`${ns4}comment`), f.literal("The class of parameter declarations, consisting of a path predicate and (possibly) information about allowed value type, cardinality and other characteristics.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Parameter`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Parameter`), f.namedNode(`${ns4}label`), f.literal("Parameter", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Parameter`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}PropertyShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Parameterizable`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Parameterizable`), f.namedNode(`${ns4}comment`), f.literal("Superclass of components that can take parameters, especially functions and constraint components.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Parameterizable`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Parameterizable`), f.namedNode(`${ns4}label`), f.literal("Parameterizable", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Parameterizable`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PathExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PathExpression`), f.namedNode(`${ns4}comment`), f.literal("A path expression is a blank node with exactly one value of the property sh:path (which are well-formed property paths) and at most one value for sh:nodes (which is a well-formed node expression)."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PathExpression`), f.namedNode(`${ns4}label`), f.literal("Path Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PathExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PathExpression`), f.namedNode(`${ns1}property`), blankNodes[25], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PathExpression`), f.namedNode(`${ns1}property`), blankNodes[26], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent-flags`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent-flags`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent-flags`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent-flags`), f.namedNode(`${ns1}optional`), f.literal("true", f.namedNode(`${ns6}boolean`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent-flags`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}flags`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent-pattern`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent-pattern`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent-pattern`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent-pattern`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}pattern`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that every value node matches a given regular expression.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Pattern constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}PatternConstraintComponent-flags`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PatternConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}PatternConstraintComponent-pattern`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PrefixDeclaration`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PrefixDeclaration`), f.namedNode(`${ns4}comment`), f.literal("The class of prefix declarations, consisting of pairs of a prefix with a namespace.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PrefixDeclaration`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PrefixDeclaration`), f.namedNode(`${ns4}label`), f.literal("Prefix declaration", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PrefixDeclaration`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyConstraintComponent-property`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyConstraintComponent-property`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyConstraintComponent-property`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that all value nodes conform to the given property shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Property constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}PropertyConstraintComponent-property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyGroup`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyGroup`), f.namedNode(`${ns4}comment`), f.literal("Instances of this class represent groups of property shapes that belong together.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyGroup`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyGroup`), f.namedNode(`${ns4}label`), f.literal("Property group", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyGroup`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyShape`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyShape`), f.namedNode(`${ns4}comment`), f.literal("A property shape is a shape that specifies constraints on the values of a focus node for a given property or path.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyShape`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyShape`), f.namedNode(`${ns4}label`), f.literal("Property shape", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}PropertyShape`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedMaxCount`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedMaxCount`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedMaxCount`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedMaxCount`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}qualifiedMaxCount`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedValueShape`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedValueShape`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedValueShape`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}qualifiedValueShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(`${ns1}optional`), f.literal("true", f.namedNode(`${ns6}boolean`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}qualifiedValueShapesDisjoint`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that a specified maximum number of value nodes conforms to a given shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Qualified-max-count constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedMaxCount`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedValueShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}QualifiedMaxCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedMinCount`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedMinCount`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedMinCount`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedMinCount`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}qualifiedMinCount`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedValueShape`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedValueShape`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedValueShape`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}qualifiedValueShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(`${ns1}optional`), f.literal("true", f.namedNode(`${ns6}boolean`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}qualifiedValueShapesDisjoint`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to verify that a specified minimum number of value nodes conforms to a given shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Qualified-min-count constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedMinCount`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedValueShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}QualifiedMinCountConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}QualifiedMinCountConstraintComponent-qualifiedValueShapesDisjoint`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ResultAnnotation`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ResultAnnotation`), f.namedNode(`${ns4}comment`), f.literal("A class of result annotations, which define the rules to derive the values of a given annotation property as extra values for a validation result.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ResultAnnotation`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ResultAnnotation`), f.namedNode(`${ns4}label`), f.literal("Result annotation", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ResultAnnotation`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Rule`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Rule`), f.namedNode(`${ns4}comment`), f.literal("The class of SHACL rules. Never instantiated directly.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Rule`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Rule`), f.namedNode(`${ns4}label`), f.literal("Rule", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Rule`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExecutable`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExecutable`), f.namedNode(`${ns4}comment`), f.literal("The class of SPARQL executables that are based on an ASK query.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExecutable`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExecutable`), f.namedNode(`${ns4}label`), f.literal("SPARQL ASK executable", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExecutable`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExpression`), f.namedNode(`${ns4}comment`), f.literal("A SPARQL ASK expression is a blank node with exactly one value for the property sh:ask which is string literal. The blank node may have values for the property sh:prefixes and these values are IRIs or blank nodes. Using the values of sh:prefixes as defined by 5.2.1 Prefix Declarations for SPARQL Queries, the value of sh:ask must be valid SPARQL 1.1 ASK query. The blank node may also have exactly one value for the property sh:nodes which is a well-formed node expression."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExpression`), f.namedNode(`${ns4}label`), f.literal("SPARQL ASK Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExpression`), f.namedNode(`${ns1}property`), blankNodes[27], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExpression`), f.namedNode(`${ns1}property`), blankNodes[28], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExpression`), f.namedNode(`${ns1}property`), blankNodes[29], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}ask`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskValidator`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskValidator`), f.namedNode(`${ns4}comment`), f.literal("The class of validators based on SPARQL ASK queries. The queries are evaluated for each value node and are supposed to return true if the given node conforms.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskValidator`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskValidator`), f.namedNode(`${ns4}label`), f.literal("SPARQL ASK validator", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskValidator`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLAskExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLAskValidator`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Validator`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraint`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraint`), f.namedNode(`${ns4}comment`), f.literal("The class of constraints based on SPARQL SELECT queries.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraint`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraint`), f.namedNode(`${ns4}label`), f.literal("SPARQL constraint", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraint`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLSelectExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraintComponent-sparql`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraintComponent-sparql`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraintComponent-sparql`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}sparql`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to define constraints based on SPARQL queries.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("SPARQL constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}SPARQLConstraintComponent-sparql`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstructExecutable`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstructExecutable`), f.namedNode(`${ns4}comment`), f.literal("The class of SPARQL executables that are based on a CONSTRUCT query.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstructExecutable`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstructExecutable`), f.namedNode(`${ns4}label`), f.literal("SPARQL CONSTRUCT executable", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLConstructExecutable`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLExecutable`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLExecutable`), f.namedNode(`${ns4}comment`), f.literal("The class of resources that encapsulate a SPARQL query.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLExecutable`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLExecutable`), f.namedNode(`${ns4}label`), f.literal("SPARQL executable", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLExecutable`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLFunction`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLFunction`), f.namedNode(`${ns4}comment`), f.literal("A function backed by a SPARQL query - either ASK or SELECT.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLFunction`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLFunction`), f.namedNode(`${ns4}label`), f.literal("SPARQL function", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLFunction`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Function`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLFunction`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLAskExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLFunction`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLSelectExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLRule`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLRule`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLRule`), f.namedNode(`${ns4}comment`), f.literal("The class of SHACL rules based on SPARQL CONSTRUCT queries.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLRule`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLRule`), f.namedNode(`${ns4}label`), f.literal("SPARQL CONSTRUCT rule", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLRule`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Rule`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLRule`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLConstructExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLRule`), f.namedNode(`${ns1}property`), blankNodes[30], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLRule`), f.namedNode(`${ns1}property`), blankNodes[31], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExecutable`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExecutable`), f.namedNode(`${ns4}comment`), f.literal("The class of SPARQL executables based on a SELECT query.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExecutable`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExecutable`), f.namedNode(`${ns4}label`), f.literal("SPARQL SELECT executable", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExecutable`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExpression`), f.namedNode(`${ns4}comment`), f.literal("A SPARQL SELECT expression is a blank node with exactly one value for the property sh:select which is string literal. The blank node may have values for the property sh:prefixes and these values are IRIs or blank nodes. Using the values of sh:prefixes as defined by 5.2.1 Prefix Declarations for SPARQL Queries, the value of sh:select must be valid SPARQL 1.1 SELECT query with exactly one result variable. The blank node may also have exactly one value for the property sh:nodes which is a well-formed node expression."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExpression`), f.namedNode(`${ns4}label`), f.literal("SPARQL SELECT Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExpression`), f.namedNode(`${ns1}property`), blankNodes[32], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExpression`), f.namedNode(`${ns1}property`), blankNodes[33], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExpression`), f.namedNode(`${ns1}property`), blankNodes[34], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}select`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectValidator`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectValidator`), f.namedNode(`${ns4}comment`), f.literal("The class of validators based on SPARQL SELECT queries. The queries are evaluated for each focus node and are supposed to produce bindings for all focus nodes that do not conform.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectValidator`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectValidator`), f.namedNode(`${ns4}label`), f.literal("SPARQL SELECT validator", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectValidator`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLSelectExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLSelectValidator`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Validator`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTarget`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTarget`), f.namedNode(`${ns4}comment`), f.literal("The class of targets that are based on SPARQL queries.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTarget`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTarget`), f.namedNode(`${ns4}label`), f.literal("SPARQL target", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTarget`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLAskExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTarget`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLSelectExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTarget`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Target`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTargetType`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTargetType`), f.namedNode(`${ns4}comment`), f.literal("The (meta) class for parameterizable targets that are based on SPARQL queries.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTargetType`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTargetType`), f.namedNode(`${ns4}label`), f.literal("SPARQL target type", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTargetType`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLAskExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTargetType`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLSelectExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLTargetType`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}TargetType`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLUpdateExecutable`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLUpdateExecutable`), f.namedNode(`${ns4}comment`), f.literal("The class of SPARQL executables based on a SPARQL UPDATE.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLUpdateExecutable`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLUpdateExecutable`), f.namedNode(`${ns4}label`), f.literal("SPARQL UPDATE executable", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SPARQLUpdateExecutable`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}SPARQLExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Severity`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Severity`), f.namedNode(`${ns4}comment`), f.literal("The class of validation result severity levels, including violation and warning levels.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Severity`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Severity`), f.namedNode(`${ns4}label`), f.literal("Severity", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Severity`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Shape`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Shape`), f.namedNode(`${ns4}comment`), f.literal("A shape is a collection of constraints that may be targeted for certain nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Shape`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Shape`), f.namedNode(`${ns4}label`), f.literal("Shape", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Shape`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SumExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SumExpression`), f.namedNode(`${ns4}comment`), f.literal("A sum expression is a blank node with exactly one value for the property sh:sum which is a well-formed node expression."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SumExpression`), f.namedNode(`${ns4}label`), f.literal("Sum Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SumExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SumExpression`), f.namedNode(`${ns1}property`), blankNodes[35], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}SumExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}sum`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Target`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Target`), f.namedNode(`${ns4}comment`), f.literal("The base class of targets such as those based on SPARQL queries.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Target`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Target`), f.namedNode(`${ns4}label`), f.literal("Target", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Target`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TargetType`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TargetType`), f.namedNode(`${ns4}comment`), f.literal("The (meta) class for parameterizable targets.	Instances of this are instantiated as values of the sh:target property.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TargetType`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TargetType`), f.namedNode(`${ns4}label`), f.literal("Target type", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TargetType`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TargetType`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Parameterizable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TripleRule`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TripleRule`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TripleRule`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TripleRule`), f.namedNode(`${ns4}label`), f.literal("A rule based on triple (subject, predicate, object) pattern.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TripleRule`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}Rule`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TripleRule`), f.namedNode(`${ns1}property`), blankNodes[36], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TripleRule`), f.namedNode(`${ns1}property`), blankNodes[37], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}TripleRule`), f.namedNode(`${ns1}property`), blankNodes[38], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UnionExpression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UnionExpression`), f.namedNode(`${ns4}comment`), f.literal("A union expression is a blank node with exactly one value for the property sh:union which is a well-formed SHACL list with at least two members (which are well-formed node expressions)."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UnionExpression`), f.namedNode(`${ns4}label`), f.literal("Union Expression"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UnionExpression`), f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UnionExpression`), f.namedNode(`${ns1}property`), blankNodes[39], f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UnionExpression`), f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns1}union`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UniqueLangConstraintComponent-uniqueLang`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UniqueLangConstraintComponent-uniqueLang`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UniqueLangConstraintComponent-uniqueLang`), f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UniqueLangConstraintComponent-uniqueLang`), f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UniqueLangConstraintComponent-uniqueLang`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}uniqueLang`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UniqueLangConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UniqueLangConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to specify that no pair of value nodes may use the same language tag.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UniqueLangConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UniqueLangConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Unique-languages constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}UniqueLangConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}UniqueLangConstraintComponent-uniqueLang`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ValidationReport`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ValidationReport`), f.namedNode(`${ns4}comment`), f.literal("The class of SHACL validation reports.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ValidationReport`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ValidationReport`), f.namedNode(`${ns4}label`), f.literal("Validation report", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ValidationReport`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ValidationResult`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ValidationResult`), f.namedNode(`${ns4}comment`), f.literal("The class of validation results.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ValidationResult`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ValidationResult`), f.namedNode(`${ns4}label`), f.literal("Validation result", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ValidationResult`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns1}AbstractResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Validator`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Validator`), f.namedNode(`${ns4}comment`), f.literal("The class of validators, which provide instructions on how to process a constraint definition. This class serves as base class for the SPARQL-based validators and other possible implementations.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Validator`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Validator`), f.namedNode(`${ns4}label`), f.literal("Validator", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Validator`), f.namedNode(`${ns4}subClassOf`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Violation`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Severity`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Violation`), f.namedNode(`${ns4}comment`), f.literal("The severity for a violation validation result.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Violation`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Violation`), f.namedNode(`${ns4}label`), f.literal("Violation", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Warning`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Severity`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Warning`), f.namedNode(`${ns4}comment`), f.literal("The severity for a warning validation result.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Warning`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}Warning`), f.namedNode(`${ns4}label`), f.literal("Warning", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}XoneConstraintComponent-xone`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}XoneConstraintComponent-xone`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}XoneConstraintComponent-xone`), f.namedNode(`${ns1}path`), f.namedNode(`${ns1}xone`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}XoneConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}XoneConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("A constraint component that can be used to restrict the value nodes so that they conform to exactly one out of several provided shapes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}XoneConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}XoneConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("Exactly one constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}XoneConstraintComponent`), f.namedNode(`${ns1}parameter`), f.namedNode(`${ns1}XoneConstraintComponent-xone`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}alternativePath`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}alternativePath`), f.namedNode(`${ns4}comment`), f.literal("The (single) value of this property must be a list of path elements, representing the elements of alternative paths.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}alternativePath`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}alternativePath`), f.namedNode(`${ns4}label`), f.literal("alternative path", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}alternativePath`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}List`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}and`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}and`), f.namedNode(`${ns4}comment`), f.literal("RDF list of shapes to validate the value nodes against.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}and`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}and`), f.namedNode(`${ns4}label`), f.literal("and", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}and`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}List`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationProperty`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationProperty`), f.namedNode(`${ns4}comment`), f.literal("The annotation property that shall be set.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationProperty`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}ResultAnnotation`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationProperty`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationProperty`), f.namedNode(`${ns4}label`), f.literal("annotation property", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationProperty`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationValue`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationValue`), f.namedNode(`${ns4}comment`), f.literal("The (default) values of the annotation property.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationValue`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}ResultAnnotation`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationValue`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationValue`), f.namedNode(`${ns4}label`), f.literal("annotation value", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationVarName`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationVarName`), f.namedNode(`${ns4}comment`), f.literal("The name of the SPARQL variable from the SELECT clause that shall be used for the values.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationVarName`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}ResultAnnotation`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationVarName`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationVarName`), f.namedNode(`${ns4}label`), f.literal("annotation variable name", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}annotationVarName`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ask`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ask`), f.namedNode(`${ns4}comment`), f.literal("The SPARQL ASK query to execute.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ask`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}SPARQLAskExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ask`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ask`), f.namedNode(`${ns4}label`), f.literal("ask", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ask`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}class`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}class`), f.namedNode(`${ns4}comment`), f.literal("The type that all value nodes must have.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}class`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}class`), f.namedNode(`${ns4}label`), f.literal("class", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}class`), f.namedNode(`${ns4}range`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}closed`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}closed`), f.namedNode(`${ns4}comment`), f.literal("If set to true then the shape is closed.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}closed`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}closed`), f.namedNode(`${ns4}label`), f.literal("closed", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}closed`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}condition`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}condition`), f.namedNode(`${ns4}comment`), f.literal("The shapes that the focus nodes need to conform to before a rule is executed on them.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}condition`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Rule`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}condition`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}condition`), f.namedNode(`${ns4}label`), f.literal("condition", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}condition`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}conforms`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}conforms`), f.namedNode(`${ns4}comment`), f.literal("True if the validation did not produce any validation results, and false otherwise.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}conforms`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}ValidationReport`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}conforms`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}conforms`), f.namedNode(`${ns4}label`), f.literal("conforms", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}conforms`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}construct`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}construct`), f.namedNode(`${ns4}comment`), f.literal("The SPARQL CONSTRUCT query to execute.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}construct`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}SPARQLConstructExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}construct`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}construct`), f.namedNode(`${ns4}label`), f.literal("construct", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}construct`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}count`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}datatype`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}datatype`), f.namedNode(`${ns4}comment`), f.literal("Specifies an RDF datatype that all value nodes must have.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}datatype`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}datatype`), f.namedNode(`${ns4}label`), f.literal("datatype", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}datatype`), f.namedNode(`${ns4}range`), f.namedNode(`${ns4}Datatype`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}deactivated`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}deactivated`), f.namedNode(`${ns4}comment`), f.literal("If set to true then all nodes conform to this.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}deactivated`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}deactivated`), f.namedNode(`${ns4}label`), f.literal("deactivated", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}deactivated`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}declare`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}declare`), f.namedNode(`${ns4}comment`), f.literal("Links a resource with its namespace prefix declarations.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}declare`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns3}Ontology`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}declare`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}declare`), f.namedNode(`${ns4}label`), f.literal("declare", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}declare`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}PrefixDeclaration`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}defaultValue`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}defaultValue`), f.namedNode(`${ns4}comment`), f.literal("A default value for a property, for example for user interface tools to pre-populate input fields.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}defaultValue`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}PropertyShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}defaultValue`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}defaultValue`), f.namedNode(`${ns4}label`), f.literal("default value", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}desc`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}description`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}description`), f.namedNode(`${ns4}comment`), f.literal("Human-readable descriptions for the property in the context of the surrounding shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}description`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}PropertyShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}description`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}description`), f.namedNode(`${ns4}label`), f.literal("description", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}detail`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}detail`), f.namedNode(`${ns4}comment`), f.literal("Links a result with other results that provide more details, for example to describe violations against nested shapes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}detail`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}AbstractResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}detail`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}detail`), f.namedNode(`${ns4}label`), f.literal("detail", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}detail`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}AbstractResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}disjoint`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}disjoint`), f.namedNode(`${ns4}comment`), f.literal("Specifies a property where the set of values must be disjoint with the value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}disjoint`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}disjoint`), f.namedNode(`${ns4}label`), f.literal("disjoint", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}disjoint`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}distinct`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}else`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}entailment`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}entailment`), f.namedNode(`${ns4}comment`), f.literal("An entailment regime that indicates what kind of inferencing is required by a shapes graph.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}entailment`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns3}Ontology`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}entailment`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}entailment`), f.namedNode(`${ns4}label`), f.literal("entailment", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}entailment`), f.namedNode(`${ns4}range`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}equals`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}equals`), f.namedNode(`${ns4}comment`), f.literal("Specifies a property that must have the same values as the value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}equals`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}equals`), f.namedNode(`${ns4}label`), f.literal("equals", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}equals`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}exists`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}expression`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}expression`), f.namedNode(`${ns4}comment`), f.literal("The node expression that must return true for the value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}expression`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}expression`), f.namedNode(`${ns4}label`), f.literal("expression", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}filterShape`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}filterShape`), f.namedNode(`${ns4}comment`), f.literal("The shape that all input nodes of the expression need to conform to.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}filterShape`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}filterShape`), f.namedNode(`${ns4}label`), f.literal("filter shape", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}filterShape`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}flags`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}flags`), f.namedNode(`${ns4}comment`), f.literal("An optional flag to be used with regular expression pattern matching.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}flags`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}flags`), f.namedNode(`${ns4}label`), f.literal("flags", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}flags`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}focusNode`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}focusNode`), f.namedNode(`${ns4}comment`), f.literal("The focus node that was validated when the result was produced.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}focusNode`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}AbstractResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}focusNode`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}focusNode`), f.namedNode(`${ns4}label`), f.literal("focus node", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}group`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}group`), f.namedNode(`${ns4}comment`), f.literal("Can be used to link to a property group to indicate that a property shape belongs to a group of related property shapes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}group`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}PropertyShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}group`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}group`), f.namedNode(`${ns4}label`), f.literal("group", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}group`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}PropertyGroup`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}groupConcat`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}hasValue`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}hasValue`), f.namedNode(`${ns4}comment`), f.literal("Specifies a value that must be among the value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}hasValue`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}hasValue`), f.namedNode(`${ns4}label`), f.literal("has value", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}if`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ignoredProperties`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ignoredProperties`), f.namedNode(`${ns4}comment`), f.literal("An optional RDF list of properties that are also permitted in addition to those explicitly enumerated via sh:property/sh:path.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ignoredProperties`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ignoredProperties`), f.namedNode(`${ns4}label`), f.literal("ignored properties", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}ignoredProperties`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}List`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}in`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}in`), f.namedNode(`${ns4}comment`), f.literal("Specifies a list of allowed values so that each value node must be among the members of the given list.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}in`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}in`), f.namedNode(`${ns4}label`), f.literal("in", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}in`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}List`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}intersection`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}intersection`), f.namedNode(`${ns4}comment`), f.literal("A list of node expressions that shall be intersected.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}intersection`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}intersection`), f.namedNode(`${ns4}label`), f.literal("intersection", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}inversePath`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}inversePath`), f.namedNode(`${ns4}comment`), f.literal("The (single) value of this property represents an inverse path (object to subject).", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}inversePath`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}inversePath`), f.namedNode(`${ns4}label`), f.literal("inverse path", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}inversePath`), f.namedNode(`${ns4}range`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}js`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}js`), f.namedNode(`${ns4}comment`), f.literal("Constraints expressed in JavaScript."), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}js`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}js`), f.namedNode(`${ns4}label`), f.literal("JavaScript constraint", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}js`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}JSConstraint`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsFunctionName`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsFunctionName`), f.namedNode(`${ns4}comment`), f.literal("The name of the JavaScript function to execute.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsFunctionName`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}JSExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsFunctionName`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsFunctionName`), f.namedNode(`${ns4}label`), f.literal("JavaScript function name", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsFunctionName`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsLibrary`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsLibrary`), f.namedNode(`${ns4}comment`), f.literal("Declares which JavaScript libraries are needed to execute this.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsLibrary`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsLibrary`), f.namedNode(`${ns4}label`), f.literal("JavaScript library", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsLibrary`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}JSLibrary`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsLibraryURL`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsLibraryURL`), f.namedNode(`${ns4}comment`), f.literal("Declares the URLs of a JavaScript library. This should be the absolute URL of a JavaScript file. Implementations may redirect those to local files.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsLibraryURL`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}JSLibrary`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsLibraryURL`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsLibraryURL`), f.namedNode(`${ns4}label`), f.literal("JavaScript library URL", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}jsLibraryURL`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}anyURI`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}labelTemplate`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}labelTemplate`), f.namedNode(`${ns4}comment`), f.literal("Outlines how human-readable labels of instances of the associated Parameterizable shall be produced. The values can contain {?paramName} as placeholders for the actual values of the given parameter.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}labelTemplate`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Parameterizable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}labelTemplate`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}labelTemplate`), f.namedNode(`${ns4}label`), f.literal("label template", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}languageIn`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}languageIn`), f.namedNode(`${ns4}comment`), f.literal("Specifies a list of language tags that all value nodes must have.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}languageIn`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}languageIn`), f.namedNode(`${ns4}label`), f.literal("language in", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}languageIn`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}List`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}lessThan`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}lessThan`), f.namedNode(`${ns4}comment`), f.literal("Specifies a property that must have smaller values than the value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}lessThan`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}lessThan`), f.namedNode(`${ns4}label`), f.literal("less than", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}lessThan`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}lessThanOrEquals`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}lessThanOrEquals`), f.namedNode(`${ns4}comment`), f.literal("Specifies a property that must have smaller or equal values than the value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}lessThanOrEquals`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}lessThanOrEquals`), f.namedNode(`${ns4}label`), f.literal("less than or equals", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}lessThanOrEquals`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}limit`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}max`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxCount`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxCount`), f.namedNode(`${ns4}comment`), f.literal("Specifies the maximum number of values in the set of value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxCount`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxCount`), f.namedNode(`${ns4}label`), f.literal("max count", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxCount`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxExclusive`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxExclusive`), f.namedNode(`${ns4}comment`), f.literal("Specifies the maximum exclusive value of each value node.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxExclusive`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxExclusive`), f.namedNode(`${ns4}label`), f.literal("max exclusive", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxInclusive`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxInclusive`), f.namedNode(`${ns4}comment`), f.literal("Specifies the maximum inclusive value of each value node.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxInclusive`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxInclusive`), f.namedNode(`${ns4}label`), f.literal("max inclusive", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxLength`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxLength`), f.namedNode(`${ns4}comment`), f.literal("Specifies the maximum string length of each value node.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxLength`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxLength`), f.namedNode(`${ns4}label`), f.literal("max length", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}maxLength`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}message`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}message`), f.namedNode(`${ns4}comment`), f.literal("A human-readable message (possibly with placeholders for variables) explaining the cause of the result.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}message`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}message`), f.namedNode(`${ns4}label`), f.literal("message", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}min`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minCount`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minCount`), f.namedNode(`${ns4}comment`), f.literal("Specifies the minimum number of values in the set of value nodes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minCount`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minCount`), f.namedNode(`${ns4}label`), f.literal("min count", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minCount`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minExclusive`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minExclusive`), f.namedNode(`${ns4}comment`), f.literal("Specifies the minimum exclusive value of each value node.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minExclusive`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minExclusive`), f.namedNode(`${ns4}label`), f.literal("min exclusive", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minInclusive`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minInclusive`), f.namedNode(`${ns4}comment`), f.literal("Specifies the minimum inclusive value of each value node.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minInclusive`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minInclusive`), f.namedNode(`${ns4}label`), f.literal("min inclusive", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minLength`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minLength`), f.namedNode(`${ns4}comment`), f.literal("Specifies the minimum string length of each value node.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minLength`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minLength`), f.namedNode(`${ns4}label`), f.literal("min length", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minLength`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}minus`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}name`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}name`), f.namedNode(`${ns4}comment`), f.literal("Human-readable labels for the property in the context of the surrounding shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}name`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}PropertyShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}name`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}name`), f.namedNode(`${ns4}label`), f.literal("name", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}namespace`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}namespace`), f.namedNode(`${ns4}comment`), f.literal("The namespace associated with a prefix in a prefix declaration.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}namespace`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}PrefixDeclaration`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}namespace`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}namespace`), f.namedNode(`${ns4}label`), f.literal("namespace", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}namespace`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}anyURI`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}node`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}node`), f.namedNode(`${ns4}comment`), f.literal("Specifies the node shape that all value nodes must conform to.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}node`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}node`), f.namedNode(`${ns4}label`), f.literal("node", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}node`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}NodeShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns4}comment`), f.literal("Specifies the node kind (e.g. IRI or literal) each value node.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns4}label`), f.literal("node kind", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}NodeKind`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodeValidator`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodeValidator`), f.namedNode(`${ns4}comment`), f.literal("The validator(s) used to evaluate a constraint in the context of a node shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodeValidator`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodeValidator`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodeValidator`), f.namedNode(`${ns4}label`), f.literal("shape validator", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodeValidator`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Validator`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodes`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodes`), f.namedNode(`${ns4}comment`), f.literal("The node expression producing the input nodes of a filter shape expression.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodes`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}nodes`), f.namedNode(`${ns4}label`), f.literal("nodes", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}not`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}not`), f.namedNode(`${ns4}comment`), f.literal("Specifies a shape that the value nodes must not conform to.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}not`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}not`), f.namedNode(`${ns4}label`), f.literal("not", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}not`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}object`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}object`), f.namedNode(`${ns4}comment`), f.literal("An expression producing the nodes that shall be inferred as objects.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}object`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}TripleRule`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}object`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}object`), f.namedNode(`${ns4}label`), f.literal("object", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}offset`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}oneOrMorePath`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}oneOrMorePath`), f.namedNode(`${ns4}comment`), f.literal("The (single) value of this property represents a path that is matched one or more times.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}oneOrMorePath`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}oneOrMorePath`), f.namedNode(`${ns4}label`), f.literal("one or more path", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}oneOrMorePath`), f.namedNode(`${ns4}range`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}optional`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}optional`), f.namedNode(`${ns4}comment`), f.literal("Indicates whether a parameter is optional.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}optional`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}optional`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}optional`), f.namedNode(`${ns4}label`), f.literal("optional", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}optional`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}or`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}or`), f.namedNode(`${ns4}comment`), f.literal("Specifies a list of shapes so that the value nodes must conform to at least one of the shapes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}or`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}or`), f.namedNode(`${ns4}label`), f.literal("or", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}or`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}List`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}order`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}order`), f.namedNode(`${ns4}comment`), f.literal("Specifies the relative order of this compared to its siblings. For example use 0 for the first, 1 for the second.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}order`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}order`), f.namedNode(`${ns4}label`), f.literal("order", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}orderBy`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}parameter`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}parameter`), f.namedNode(`${ns4}comment`), f.literal("The parameters of a function or constraint component.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}parameter`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Parameterizable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}parameter`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}parameter`), f.namedNode(`${ns4}label`), f.literal("parameter", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}parameter`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Parameter`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}path`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}path`), f.namedNode(`${ns4}comment`), f.literal("Specifies the property path of a property shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}path`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}PropertyShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}path`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}path`), f.namedNode(`${ns4}label`), f.literal("path", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}path`), f.namedNode(`${ns4}range`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}pattern`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}pattern`), f.namedNode(`${ns4}comment`), f.literal("Specifies a regular expression pattern that the string representations of the value nodes must match.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}pattern`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}pattern`), f.namedNode(`${ns4}label`), f.literal("pattern", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}pattern`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}predicate`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}predicate`), f.namedNode(`${ns4}comment`), f.literal("An expression producing the properties that shall be inferred as predicates.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}predicate`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}TripleRule`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}predicate`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}predicate`), f.namedNode(`${ns4}label`), f.literal("predicate", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefix`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefix`), f.namedNode(`${ns4}comment`), f.literal("The prefix of a prefix declaration.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefix`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}PrefixDeclaration`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefix`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefix`), f.namedNode(`${ns4}label`), f.literal("prefix", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefix`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefixes`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefixes`), f.namedNode(`${ns4}comment`), f.literal("The prefixes that shall be applied before parsing the associated SPARQL query.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefixes`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}SPARQLExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefixes`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefixes`), f.namedNode(`${ns4}label`), f.literal("prefixes", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}prefixes`), f.namedNode(`${ns4}range`), f.namedNode(`${ns3}Ontology`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}property`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}property`), f.namedNode(`${ns4}comment`), f.literal("Links a shape to its property shapes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}property`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}property`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}property`), f.namedNode(`${ns4}label`), f.literal("property", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}property`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}PropertyShape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}propertyValidator`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}propertyValidator`), f.namedNode(`${ns4}comment`), f.literal("The validator(s) used to evaluate a constraint in the context of a property shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}propertyValidator`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}propertyValidator`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}propertyValidator`), f.namedNode(`${ns4}label`), f.literal("property validator", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}propertyValidator`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Validator`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedMaxCount`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedMaxCount`), f.namedNode(`${ns4}comment`), f.literal("The maximum number of value nodes that can conform to the shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedMaxCount`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedMaxCount`), f.namedNode(`${ns4}label`), f.literal("qualified max count", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedMaxCount`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedMinCount`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedMinCount`), f.namedNode(`${ns4}comment`), f.literal("The minimum number of value nodes that must conform to the shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedMinCount`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedMinCount`), f.namedNode(`${ns4}label`), f.literal("qualified min count", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedMinCount`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedValueShape`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedValueShape`), f.namedNode(`${ns4}comment`), f.literal("The shape that a specified number of values must conform to.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedValueShape`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedValueShape`), f.namedNode(`${ns4}label`), f.literal("qualified value shape", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedValueShape`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedValueShapesDisjoint`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedValueShapesDisjoint`), f.namedNode(`${ns4}comment`), f.literal("Can be used to mark the qualified value shape to be disjoint with its sibling shapes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedValueShapesDisjoint`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedValueShapesDisjoint`), f.namedNode(`${ns4}label`), f.literal("qualified value shapes disjoint", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}qualifiedValueShapesDisjoint`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}result`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}result`), f.namedNode(`${ns4}comment`), f.literal("The validation results contained in a validation report.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}result`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}ValidationReport`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}result`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}result`), f.namedNode(`${ns4}label`), f.literal("result", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}result`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}ValidationResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultAnnotation`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultAnnotation`), f.namedNode(`${ns4}comment`), f.literal("Links a SPARQL validator with zero or more sh:ResultAnnotation instances, defining how to derive additional result properties based on the variables of the SELECT query.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultAnnotation`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}SPARQLSelectValidator`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultAnnotation`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultAnnotation`), f.namedNode(`${ns4}label`), f.literal("result annotation", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultAnnotation`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}ResultAnnotation`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultMessage`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultMessage`), f.namedNode(`${ns4}comment`), f.literal("Human-readable messages explaining the cause of the result.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultMessage`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}AbstractResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultMessage`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultMessage`), f.namedNode(`${ns4}label`), f.literal("result message", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultPath`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultPath`), f.namedNode(`${ns4}comment`), f.literal("The path of a validation result, based on the path of the validated property shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultPath`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}AbstractResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultPath`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultPath`), f.namedNode(`${ns4}label`), f.literal("result path", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultPath`), f.namedNode(`${ns4}range`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultSeverity`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultSeverity`), f.namedNode(`${ns4}comment`), f.literal("The severity of the result, e.g. warning.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultSeverity`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}AbstractResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultSeverity`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultSeverity`), f.namedNode(`${ns4}label`), f.literal("result severity", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}resultSeverity`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Severity`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}returnType`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}returnType`), f.namedNode(`${ns4}comment`), f.literal("The expected type of values returned by the associated function.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}returnType`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Function`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}returnType`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}returnType`), f.namedNode(`${ns4}label`), f.literal("return type", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}returnType`), f.namedNode(`${ns4}range`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}rule`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}rule`), f.namedNode(`${ns4}comment`), f.literal("The rules linked to a shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}rule`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}rule`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}rule`), f.namedNode(`${ns4}label`), f.literal("rule", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}rule`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Rule`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}select`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}select`), f.namedNode(`${ns4}comment`), f.literal("The SPARQL SELECT query to execute.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}select`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}SPARQLSelectExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}select`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}select`), f.namedNode(`${ns4}label`), f.literal("select", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}select`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}separator`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}severity`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}severity`), f.namedNode(`${ns4}comment`), f.literal("Defines the severity that validation results produced by a shape must have. Defaults to sh:Violation.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}severity`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}severity`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}severity`), f.namedNode(`${ns4}label`), f.literal("severity", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}severity`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Severity`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraph`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraph`), f.namedNode(`${ns4}comment`), f.literal("Shapes graphs that should be used when validating this data graph.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraph`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns3}Ontology`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraph`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraph`), f.namedNode(`${ns4}label`), f.literal("shapes graph", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraph`), f.namedNode(`${ns4}range`), f.namedNode(`${ns3}Ontology`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraphWellFormed`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraphWellFormed`), f.namedNode(`${ns4}comment`), f.literal("If true then the validation engine was certain that the shapes graph has passed all SHACL syntax requirements during the validation process.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraphWellFormed`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}ValidationReport`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraphWellFormed`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraphWellFormed`), f.namedNode(`${ns4}label`), f.literal("shapes graph well-formed", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}shapesGraphWellFormed`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceConstraint`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceConstraint`), f.namedNode(`${ns4}comment`), f.literal("The constraint that was validated when the result was produced.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceConstraint`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}AbstractResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceConstraint`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceConstraint`), f.namedNode(`${ns4}label`), f.literal("source constraint", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceConstraintComponent`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceConstraintComponent`), f.namedNode(`${ns4}comment`), f.literal("The constraint component that is the source of the result.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceConstraintComponent`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}AbstractResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceConstraintComponent`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceConstraintComponent`), f.namedNode(`${ns4}label`), f.literal("source constraint component", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceConstraintComponent`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceShape`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceShape`), f.namedNode(`${ns4}comment`), f.literal("The shape that is was validated when the result was produced.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceShape`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}AbstractResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceShape`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceShape`), f.namedNode(`${ns4}label`), f.literal("source shape", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sourceShape`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sparql`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sparql`), f.namedNode(`${ns4}comment`), f.literal("Links a shape with SPARQL constraints.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sparql`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sparql`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sparql`), f.namedNode(`${ns4}label`), f.literal("constraint (in SPARQL)", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sparql`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}SPARQLConstraint`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}subject`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}subject`), f.namedNode(`${ns4}comment`), f.literal("An expression producing the resources that shall be inferred as subjects.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}subject`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}TripleRule`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}subject`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}subject`), f.namedNode(`${ns4}label`), f.literal("subject", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}suggestedShapesGraph`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}suggestedShapesGraph`), f.namedNode(`${ns4}comment`), f.literal("Suggested shapes graphs for this ontology. The values of this property may be used in the absence of specific sh:shapesGraph statements.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}suggestedShapesGraph`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns3}Ontology`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}suggestedShapesGraph`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}suggestedShapesGraph`), f.namedNode(`${ns4}label`), f.literal("suggested shapes graph", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}suggestedShapesGraph`), f.namedNode(`${ns4}range`), f.namedNode(`${ns3}Ontology`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}sum`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}target`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}target`), f.namedNode(`${ns4}comment`), f.literal("Links a shape to a target specified by an extension language, for example instances of sh:SPARQLTarget.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}target`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}target`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}target`), f.namedNode(`${ns4}label`), f.literal("target", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}target`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Target`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetClass`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetClass`), f.namedNode(`${ns4}comment`), f.literal("Links a shape to a class, indicating that all instances of the class must conform to the shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetClass`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetClass`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetClass`), f.namedNode(`${ns4}label`), f.literal("target class", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetClass`), f.namedNode(`${ns4}range`), f.namedNode(`${ns4}Class`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetNode`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetNode`), f.namedNode(`${ns4}comment`), f.literal("Links a shape to individual nodes, indicating that these nodes must conform to the shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetNode`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetNode`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetNode`), f.namedNode(`${ns4}label`), f.literal("target node", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetObjectsOf`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetObjectsOf`), f.namedNode(`${ns4}comment`), f.literal("Links a shape to a property, indicating that all all objects of triples that have the given property as their predicate must conform to the shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetObjectsOf`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetObjectsOf`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetObjectsOf`), f.namedNode(`${ns4}label`), f.literal("target objects of", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetObjectsOf`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns4}comment`), f.literal("Links a shape to a property, indicating that all subjects of triples that have the given property as their predicate must conform to the shape.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}Shape`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns4}label`), f.literal("target subjects of", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}targetSubjectsOf`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}then`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}this`), f.namedNode(`${ns2}type`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}this`), f.namedNode(`${ns4}comment`), f.literal("A node expression that represents the current focus node.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}this`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}this`), f.namedNode(`${ns4}label`), f.literal("this", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}union`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}union`), f.namedNode(`${ns4}comment`), f.literal("A list of node expressions that shall be used together.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}union`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}union`), f.namedNode(`${ns4}label`), f.literal("union", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}uniqueLang`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}uniqueLang`), f.namedNode(`${ns4}comment`), f.literal("Specifies whether all node values must have a unique (or no) language tag.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}uniqueLang`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}uniqueLang`), f.namedNode(`${ns4}label`), f.literal("unique languages", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}uniqueLang`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}update`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}update`), f.namedNode(`${ns4}comment`), f.literal("The SPARQL UPDATE to execute.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}update`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}SPARQLUpdateExecutable`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}update`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}update`), f.namedNode(`${ns4}label`), f.literal("update", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}update`), f.namedNode(`${ns4}range`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}validator`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}validator`), f.namedNode(`${ns4}comment`), f.literal("The validator(s) used to evaluate constraints of either node or property shapes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}validator`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}ConstraintComponent`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}validator`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}validator`), f.namedNode(`${ns4}label`), f.literal("validator", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}validator`), f.namedNode(`${ns4}range`), f.namedNode(`${ns1}Validator`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}value`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}value`), f.namedNode(`${ns4}comment`), f.literal("An RDF node that has caused the result.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}value`), f.namedNode(`${ns4}domain`), f.namedNode(`${ns1}AbstractResult`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}value`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}value`), f.namedNode(`${ns4}label`), f.literal("value", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}values`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}xone`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}xone`), f.namedNode(`${ns4}comment`), f.literal("Specifies a list of shapes so that the value nodes must conform to exactly one of the shapes.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}xone`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}xone`), f.namedNode(`${ns4}label`), f.literal("exactly one", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}xone`), f.namedNode(`${ns4}range`), f.namedNode(`${ns2}List`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}zeroOrMorePath`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}zeroOrMorePath`), f.namedNode(`${ns4}comment`), f.literal("The (single) value of this property represents a path that is matched zero or more times.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}zeroOrMorePath`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}zeroOrMorePath`), f.namedNode(`${ns4}label`), f.literal("zero or more path", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}zeroOrMorePath`), f.namedNode(`${ns4}range`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}zeroOrOnePath`), f.namedNode(`${ns2}type`), f.namedNode(`${ns2}Property`), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}zeroOrOnePath`), f.namedNode(`${ns4}comment`), f.literal("The (single) value of this property represents a path that is matched zero or one times.", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}zeroOrOnePath`), f.namedNode(`${ns4}isDefinedBy`), f.namedNode(ns1), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}zeroOrOnePath`), f.namedNode(`${ns4}label`), f.literal("zero or one path", "en"), f.namedNode(ns1)),
    f.quad(f.namedNode(`${ns1}zeroOrOnePath`), f.namedNode(`${ns4}range`), f.namedNode(`${ns4}Resource`), f.namedNode(ns1)),
    f.quad(blankNodes[4], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[4], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[4], f.namedNode(`${ns1}node`), f.namedNode(`${ns5}ShapeShape`), f.namedNode(ns1)),
    f.quad(blankNodes[4], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}filterShape`), f.namedNode(ns1)),
    f.quad(blankNodes[40], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}IfExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[40], f.namedNode(`${ns2}rest`), blankNodes[41], f.namedNode(ns1)),
    f.quad(blankNodes[16], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[16], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[16], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[16], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}nodes`), f.namedNode(ns1)),
    f.quad(blankNodes[32], f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(blankNodes[32], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[32], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[32], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}select`), f.namedNode(ns1)),
    f.quad(blankNodes[6], f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(blankNodes[6], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[6], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}separator`), f.namedNode(ns1)),
    f.quad(blankNodes[42], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}BlankNodeOrLiteral`), f.namedNode(ns1)),
    f.quad(blankNodes[42], f.namedNode(`${ns2}rest`), blankNodes[43], f.namedNode(ns1)),
    f.quad(blankNodes[19], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(blankNodes[19], f.namedNode(`${ns2}rest`), blankNodes[44], f.namedNode(ns1)),
    f.quad(blankNodes[45], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}MinExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[45], f.namedNode(`${ns2}rest`), blankNodes[46], f.namedNode(ns1)),
    f.quad(blankNodes[47], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}SPARQLAskExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[47], f.namedNode(`${ns2}rest`), blankNodes[48], f.namedNode(ns1)),
    f.quad(blankNodes[25], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[25], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[25], f.namedNode(`${ns1}node`), f.namedNode(`${ns5}PathShape`), f.namedNode(ns1)),
    f.quad(blankNodes[25], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}path`), f.namedNode(ns1)),
    f.quad(blankNodes[49], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}MinusExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[49], f.namedNode(`${ns2}rest`), blankNodes[50], f.namedNode(ns1)),
    f.quad(blankNodes[46], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}MaxExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[46], f.namedNode(`${ns2}rest`), blankNodes[51], f.namedNode(ns1)),
    f.quad(blankNodes[52], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}LimitExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[52], f.namedNode(`${ns2}rest`), blankNodes[53], f.namedNode(ns1)),
    f.quad(blankNodes[8], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[8], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[8], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}then`), f.namedNode(ns1)),
    f.quad(blankNodes[44], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}IRI`), f.namedNode(ns1)),
    f.quad(blankNodes[44], f.namedNode(`${ns2}rest`), blankNodes[54], f.namedNode(ns1)),
    f.quad(blankNodes[55], f.namedNode(`${ns1}zeroOrMorePath`), f.namedNode(`${ns2}rest`), f.namedNode(ns1)),
    f.quad(blankNodes[5], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[5], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[5], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}nodes`), f.namedNode(ns1)),
    f.quad(blankNodes[56], f.namedNode(`${ns2}first`), blankNodes[57], f.namedNode(ns1)),
    f.quad(blankNodes[56], f.namedNode(`${ns2}rest`), f.namedNode(`${ns2}nil`), f.namedNode(ns1)),
    f.quad(blankNodes[0], f.namedNode(`${ns1}namespace`), f.literal("http://www.w3.org/ns/shacl#"), f.namedNode(ns1)),
    f.quad(blankNodes[0], f.namedNode(`${ns1}prefix`), f.literal("sh"), f.namedNode(ns1)),
    f.quad(blankNodes[58], f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNode`), f.namedNode(ns1)),
    f.quad(blankNodes[58], f.namedNode(`${ns1}not`), blankNodes[59], f.namedNode(ns1)),
    f.quad(blankNodes[18], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}FocusNodeOrConstantTermExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[18], f.namedNode(`${ns2}rest`), blankNodes[60], f.namedNode(ns1)),
    f.quad(blankNodes[15], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[15], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[15], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[15], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}min`), f.namedNode(ns1)),
    f.quad(blankNodes[30], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[30], f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNodeOrIRI`), f.namedNode(ns1)),
    f.quad(blankNodes[30], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}prefixes`), f.namedNode(ns1)),
    f.quad(blankNodes[61], f.namedNode(`${ns2}first`), blankNodes[55], f.namedNode(ns1)),
    f.quad(blankNodes[61], f.namedNode(`${ns2}rest`), blankNodes[62], f.namedNode(ns1)),
    f.quad(blankNodes[1], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[1], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[1], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[1], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}count`), f.namedNode(ns1)),
    f.quad(blankNodes[12], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[12], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[12], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[12], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}nodes`), f.namedNode(ns1)),
    f.quad(blankNodes[33], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[33], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[33], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}nodes`), f.namedNode(ns1)),
    f.quad(blankNodes[63], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[63], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[63], f.namedNode(`${ns1}node`), f.namedNode(`${ns7}ListShape`), f.namedNode(ns1)),
    f.quad(blankNodes[63], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}intersection`), f.namedNode(ns1)),
    f.quad(blankNodes[63], f.namedNode(`${ns1}property`), blankNodes[64], f.namedNode(ns1)),
    f.quad(blankNodes[13], f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(blankNodes[13], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[13], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[13], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}limit`), f.namedNode(ns1)),
    f.quad(blankNodes[59], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}ExistsExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[59], f.namedNode(`${ns2}rest`), blankNodes[40], f.namedNode(ns1)),
    f.quad(blankNodes[36], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[36], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[36], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[36], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}object`), f.namedNode(ns1)),
    f.quad(blankNodes[2], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[2], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[2], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[2], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}distinct`), f.namedNode(ns1)),
    f.quad(blankNodes[65], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}IntersectionExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[65], f.namedNode(`${ns2}rest`), blankNodes[66], f.namedNode(ns1)),
    f.quad(blankNodes[57], f.namedNode(`${ns1}xone`), blankNodes[59], f.namedNode(ns1)),
    f.quad(blankNodes[34], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[34], f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNodeOrIRI`), f.namedNode(ns1)),
    f.quad(blankNodes[34], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}prefixes`), f.namedNode(ns1)),
    f.quad(blankNodes[67], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}GroupConcatExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[67], f.namedNode(`${ns2}rest`), blankNodes[68], f.namedNode(ns1)),
    f.quad(blankNodes[20], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[20], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[20], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[20], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}nodes`), f.namedNode(ns1)),
    f.quad(blankNodes[69], f.namedNode(`${ns1}property`), blankNodes[63], f.namedNode(ns1)),
    f.quad(blankNodes[27], f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(blankNodes[27], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[27], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[27], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}ask`), f.namedNode(ns1)),
    f.quad(blankNodes[28], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[28], f.namedNode(`${ns1}nodeKind`), f.namedNode(`${ns1}BlankNodeOrIRI`), f.namedNode(ns1)),
    f.quad(blankNodes[28], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}prefixes`), f.namedNode(ns1)),
    f.quad(blankNodes[64], f.namedNode(`${ns1}minCount`), f.literal("2", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[64], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[64], f.namedNode(`${ns1}path`), blankNodes[61], f.namedNode(ns1)),
    f.quad(blankNodes[22], f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}boolean`), f.namedNode(ns1)),
    f.quad(blankNodes[22], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[22], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}desc`), f.namedNode(ns1)),
    f.quad(blankNodes[29], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[29], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[29], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}nodes`), f.namedNode(ns1)),
    f.quad(blankNodes[41], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}FilterShapeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[41], f.namedNode(`${ns2}rest`), blankNodes[70], f.namedNode(ns1)),
    f.quad(blankNodes[62], f.namedNode(`${ns2}first`), f.namedNode(`${ns2}first`), f.namedNode(ns1)),
    f.quad(blankNodes[62], f.namedNode(`${ns2}rest`), f.namedNode(`${ns2}nil`), f.namedNode(ns1)),
    f.quad(blankNodes[48], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}SPARQLSelectExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[48], f.namedNode(`${ns2}rest`), f.namedNode(`${ns2}nil`), f.namedNode(ns1)),
    f.quad(blankNodes[26], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[26], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[26], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}nodes`), f.namedNode(ns1)),
    f.quad(blankNodes[71], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}CountExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[71], f.namedNode(`${ns2}rest`), blankNodes[45], f.namedNode(ns1)),
    f.quad(blankNodes[7], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[7], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[7], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[7], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}groupConcat`), f.namedNode(ns1)),
    f.quad(blankNodes[54], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}Literal`), f.namedNode(ns1)),
    f.quad(blankNodes[54], f.namedNode(`${ns2}rest`), blankNodes[72], f.namedNode(ns1)),
    f.quad(blankNodes[23], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[23], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[23], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[23], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}nodes`), f.namedNode(ns1)),
    f.quad(blankNodes[21], f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}integer`), f.namedNode(ns1)),
    f.quad(blankNodes[21], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[21], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[21], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}offset`), f.namedNode(ns1)),
    f.quad(blankNodes[50], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}DistinctExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[50], f.namedNode(`${ns2}rest`), blankNodes[71], f.namedNode(ns1)),
    f.quad(blankNodes[14], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[14], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[14], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[14], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}max`), f.namedNode(ns1)),
    f.quad(blankNodes[51], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}SumExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[51], f.namedNode(`${ns2}rest`), blankNodes[67], f.namedNode(ns1)),
    f.quad(blankNodes[68], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}OrderByExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[68], f.namedNode(`${ns2}rest`), blankNodes[52], f.namedNode(ns1)),
    f.quad(blankNodes[60], f.namedNode(`${ns2}first`), blankNodes[58], f.namedNode(ns1)),
    f.quad(blankNodes[60], f.namedNode(`${ns2}rest`), blankNodes[56], f.namedNode(ns1)),
    f.quad(blankNodes[24], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[24], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[24], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[24], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}orderBy`), f.namedNode(ns1)),
    f.quad(blankNodes[35], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[35], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[35], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[35], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}sum`), f.namedNode(ns1)),
    f.quad(blankNodes[3], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[3], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[3], f.namedNode(`${ns1}node`), f.namedNode(`${ns5}ShapeShape`), f.namedNode(ns1)),
    f.quad(blankNodes[3], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}exists`), f.namedNode(ns1)),
    f.quad(blankNodes[37], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[37], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[37], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[37], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}subject`), f.namedNode(ns1)),
    f.quad(blankNodes[11], f.namedNode(`${ns1}and`), blankNodes[73], f.namedNode(ns1)),
    f.quad(blankNodes[11], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[11], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[11], f.namedNode(`${ns1}node`), f.namedNode(`${ns7}ListShape`), f.namedNode(ns1)),
    f.quad(blankNodes[11], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}intersection`), f.namedNode(ns1)),
    f.quad(blankNodes[9], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[9], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[9], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[9], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}if`), f.namedNode(ns1)),
    f.quad(blankNodes[53], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}OffsetExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[53], f.namedNode(`${ns2}rest`), blankNodes[47], f.namedNode(ns1)),
    f.quad(blankNodes[72], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}BlankNodeOrIRI`), f.namedNode(ns1)),
    f.quad(blankNodes[72], f.namedNode(`${ns2}rest`), blankNodes[42], f.namedNode(ns1)),
    f.quad(blankNodes[70], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}PathExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[70], f.namedNode(`${ns2}rest`), blankNodes[65], f.namedNode(ns1)),
    f.quad(blankNodes[38], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[38], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[38], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[38], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}predicate`), f.namedNode(ns1)),
    f.quad(blankNodes[39], f.namedNode(`${ns1}and`), blankNodes[74], f.namedNode(ns1)),
    f.quad(blankNodes[39], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[39], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[39], f.namedNode(`${ns1}node`), f.namedNode(`${ns7}ListShape`), f.namedNode(ns1)),
    f.quad(blankNodes[39], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}union`), f.namedNode(ns1)),
    f.quad(blankNodes[66], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}UnionExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[66], f.namedNode(`${ns2}rest`), blankNodes[49], f.namedNode(ns1)),
    f.quad(blankNodes[10], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[10], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[10], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}else`), f.namedNode(ns1)),
    f.quad(blankNodes[17], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[17], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[17], f.namedNode(`${ns1}node`), f.namedNode(`${ns1}NodeExpression`), f.namedNode(ns1)),
    f.quad(blankNodes[17], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}minus`), f.namedNode(ns1)),
    f.quad(blankNodes[74], f.namedNode(`${ns2}first`), blankNodes[75], f.namedNode(ns1)),
    f.quad(blankNodes[74], f.namedNode(`${ns2}rest`), f.namedNode(`${ns2}nil`), f.namedNode(ns1)),
    f.quad(blankNodes[73], f.namedNode(`${ns2}first`), blankNodes[75], f.namedNode(ns1)),
    f.quad(blankNodes[73], f.namedNode(`${ns2}rest`), f.namedNode(`${ns2}nil`), f.namedNode(ns1)),
    f.quad(blankNodes[31], f.namedNode(`${ns1}datatype`), f.namedNode(`${ns6}string`), f.namedNode(ns1)),
    f.quad(blankNodes[31], f.namedNode(`${ns1}maxCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[31], f.namedNode(`${ns1}minCount`), f.literal("1", f.namedNode(`${ns6}integer`)), f.namedNode(ns1)),
    f.quad(blankNodes[31], f.namedNode(`${ns1}path`), f.namedNode(`${ns1}construct`), f.namedNode(ns1)),
    f.quad(blankNodes[43], f.namedNode(`${ns2}first`), f.namedNode(`${ns1}IRIOrLiteral`), f.namedNode(ns1)),
    f.quad(blankNodes[43], f.namedNode(`${ns2}rest`), f.namedNode(`${ns2}nil`), f.namedNode(ns1))
  ];
};

// ../../node_modules/.pnpm/@rdfjs+to-ntriples@3.0.1/node_modules/@rdfjs/to-ntriples/lib/blankNode.js
function blankNode2(blankNode3) {
  return "_:" + blankNode3.value;
}
var blankNode_default = blankNode2;

// ../../node_modules/.pnpm/@rdfjs+to-ntriples@3.0.1/node_modules/@rdfjs/to-ntriples/lib/dataset.js
function dataset(dataset2, toNT2) {
  return [...dataset2].map((quad2) => toNT2(quad2)).join("\n") + "\n";
}
var dataset_default = dataset;

// ../../node_modules/.pnpm/@rdfjs+to-ntriples@3.0.1/node_modules/@rdfjs/to-ntriples/lib/defaultGraph.js
function defaultGraph() {
  return "";
}
var defaultGraph_default = defaultGraph;

// ../../node_modules/.pnpm/@rdfjs+to-ntriples@3.0.1/node_modules/@rdfjs/to-ntriples/lib/namedNode.js
function namedNode2(namedNode3) {
  return "<" + namedNode3.value + ">";
}
var namedNode_default = namedNode2;

// ../../node_modules/.pnpm/@rdfjs+to-ntriples@3.0.1/node_modules/@rdfjs/to-ntriples/lib/literal.js
var echarRegEx = /["\\\\\n\r]/;
var echarRegExAll = /["\\\\\n\r]/g;
var echarReplacement = {
  '"': '\\"',
  "\\": "\\\\",
  "\n": "\\n",
  "\r": "\\r"
};
function echarReplacer(char) {
  return echarReplacement[char];
}
function escapeValue(value) {
  if (echarRegEx.test(value)) {
    return value.replace(echarRegExAll, echarReplacer);
  }
  return value;
}
function literal2(literal3) {
  const escapedValue = escapeValue(literal3.value);
  if (literal3.datatype.value === "http://www.w3.org/2001/XMLSchema#string") {
    return '"' + escapedValue + '"';
  }
  if (literal3.datatype.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString") {
    return '"' + escapedValue + '"@' + literal3.language;
  }
  return '"' + escapedValue + '"^^' + namedNode_default(literal3.datatype);
}
var literal_default = literal2;

// ../../node_modules/.pnpm/@rdfjs+to-ntriples@3.0.1/node_modules/@rdfjs/to-ntriples/lib/quad.js
function quad(quad2, toNT2) {
  const subjectString = toNT2(quad2.subject);
  const predicateString = toNT2(quad2.predicate);
  const objectString = toNT2(quad2.object);
  const graphString = toNT2(quad2.graph);
  return `${subjectString} ${predicateString} ${objectString} ${graphString ? graphString + " " : ""}.`;
}
var quad_default = quad;

// ../../node_modules/.pnpm/@rdfjs+to-ntriples@3.0.1/node_modules/@rdfjs/to-ntriples/lib/variable.js
function variable(variable2) {
  return "?" + variable2.value;
}
var variable_default = variable;

// ../../node_modules/.pnpm/@rdfjs+to-ntriples@3.0.1/node_modules/@rdfjs/to-ntriples/index.js
function toNT(term2) {
  if (!term2) {
    return null;
  }
  if (term2.termType === "BlankNode") {
    return blankNode_default(term2);
  }
  if (term2.termType === "DefaultGraph") {
    return defaultGraph_default();
  }
  if (term2.termType === "Literal") {
    return literal_default(term2);
  }
  if (term2.termType === "NamedNode") {
    return namedNode_default(term2);
  }
  if (term2.termType === "Quad" || term2.subject && term2.predicate && term2.object && term2.graph) {
    return quad_default(term2, toNT);
  }
  if (term2.termType === "Variable") {
    return variable_default(term2);
  }
  if (term2[Symbol.iterator]) {
    return dataset_default(term2, toNT);
  }
  throw new Error(`unknown termType ${term2.termType}`);
}
var to_ntriples_default = toNT;

// ../../node_modules/.pnpm/@rdfjs+term-set@2.0.3/node_modules/@rdfjs/term-set/TermSet.js
function quietToNT(term2) {
  try {
    return to_ntriples_default(term2);
  } catch (err2) {
    return null;
  }
}
var TermSet = class {
  constructor(terms) {
    this.index = /* @__PURE__ */ new Map();
    if (terms) {
      for (const term2 of terms) {
        this.add(term2);
      }
    }
  }
  get size() {
    return this.index.size;
  }
  add(term2) {
    const key = to_ntriples_default(term2);
    if (!this.index.has(key)) {
      this.index.set(key, term2);
    }
    return this;
  }
  clear() {
    this.index.clear();
  }
  delete(term2) {
    if (!term2) {
      return false;
    }
    return this.index.delete(quietToNT(term2));
  }
  entries() {
    return this.values().entries();
  }
  forEach(callbackfn, thisArg) {
    return this.values().forEach(callbackfn, thisArg);
  }
  has(term2) {
    if (!term2) {
      return false;
    }
    return this.index.has(quietToNT(term2));
  }
  values() {
    return new Set(this.index.values());
  }
  keys() {
    return this.values();
  }
  [Symbol.iterator]() {
    return this.index.values();
  }
};
var TermSet_default = TermSet;

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/node-set.js
var NodeSet = class extends TermSet_default {
  addAll(nodes) {
    for (const node of nodes) {
      this.add(node);
    }
  }
};
var node_set_default = NodeSet;

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/validation-function.js
var globalObject = typeof window !== "undefined" ? window : global;
var ValidationFunctionExecutor = class {
  context;
  functionName;
  func;
  constructor(context, functionName, func) {
    this.context = context;
    this.functionName = functionName;
    this.func = func;
  }
  execute(focusNode, valueNode, constraint) {
    return this.func.apply(globalObject, [this.context, focusNode, valueNode, constraint]);
  }
};
var validation_function_default = ValidationFunctionExecutor;

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/acl.js
var builder = namespace_default("http://www.w3.org/ns/auth/acl#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/as.js
var builder2 = namespace_default("https://www.w3.org/ns/activitystreams#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/bibo.js
var builder3 = namespace_default("http://purl.org/ontology/bibo/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/cc.js
var builder4 = namespace_default("http://creativecommons.org/ns#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/cert.js
var builder5 = namespace_default("http://www.w3.org/ns/auth/cert#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/cnt.js
var builder6 = namespace_default("http://www.w3.org/2011/content#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/constant.js
var builder7 = namespace_default("http://qudt.org/vocab/constant/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/crm.js
var builder8 = namespace_default("http://www.cidoc-crm.org/cidoc-crm/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/csvw.js
var builder9 = namespace_default("http://www.w3.org/ns/csvw#");
var strict = builder9;

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/ctag.js
var builder10 = namespace_default("http://commontag.org/ns#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/cur.js
var builder11 = namespace_default("http://qudt.org/vocab/currency/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dash-sparql.js
var builder12 = namespace_default("http://datashapes.org/sparql#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dash.js
var builder13 = namespace_default("http://datashapes.org/dash#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dbo.js
var builder14 = namespace_default("http://dbpedia.org/ontology/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dc11.js
var builder15 = namespace_default("http://purl.org/dc/elements/1.1/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dcam.js
var builder16 = namespace_default("http://purl.org/dc/dcam/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dcat.js
var builder17 = namespace_default("http://www.w3.org/ns/dcat#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dcmitype.js
var builder18 = namespace_default("http://purl.org/dc/dcmitype/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dcterms.js
var builder19 = namespace_default("http://purl.org/dc/terms/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dig.js
var builder20 = namespace_default("http://www.ics.forth.gr/isl/CRMdig/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/discipline.js
var builder21 = namespace_default("http://qudt.org/vocab/discipline/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/doap.js
var builder22 = namespace_default("http://usefulinc.com/ns/doap#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dprod.js
var builder23 = namespace_default("https://ekgf.github.io/dprod/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dpv.js
var builder24 = namespace_default("http://www.w3.org/ns/dpv#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dqv.js
var builder25 = namespace_default("http://www.w3.org/ns/dqv#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/dtype.js
var builder26 = namespace_default("http://www.linkedmodel.org/schema/dtype#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/duv.js
var builder27 = namespace_default("http://www.w3.org/ns/duv#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/earl.js
var builder28 = namespace_default("http://www.w3.org/ns/earl#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/ebucore.js
var builder29 = namespace_default("http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/exif.js
var builder30 = namespace_default("http://www.w3.org/2003/12/exif/ns#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/foaf.js
var builder31 = namespace_default("http://xmlns.com/foaf/0.1/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/frbr.js
var builder32 = namespace_default("http://purl.org/vocab/frbr/core#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/geo.js
var builder33 = namespace_default("http://www.opengis.net/ont/geosparql#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/geof.js
var builder34 = namespace_default("http://www.opengis.net/def/function/geosparql/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/geor.js
var builder35 = namespace_default("http://www.opengis.net/def/rule/geosparql/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/gml.js
var builder36 = namespace_default("http://www.opengis.net/ont/gml#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/gn.js
var builder37 = namespace_default("http://www.geonames.org/ontology#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/gr.js
var builder38 = namespace_default("http://purl.org/goodrelations/v1#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/grddl.js
var builder39 = namespace_default("http://www.w3.org/2003/g/data-view#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/gs1.js
var builder40 = namespace_default("https://gs1.org/voc/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/gtfs.js
var builder41 = namespace_default("http://vocab.gtfs.org/terms#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/http.js
var builder42 = namespace_default("http://www.w3.org/2011/http#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/hydra.js
var builder43 = namespace_default("http://www.w3.org/ns/hydra/core#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/ical.js
var builder44 = namespace_default("http://www.w3.org/2002/12/cal/icaltzd#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/la.js
var builder45 = namespace_default("https://linked.art/ns/terms/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/ldp.js
var builder46 = namespace_default("http://www.w3.org/ns/ldp#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/list.js
var builder47 = namespace_default("http://www.w3.org/2000/10/swap/list#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/locn.js
var builder48 = namespace_default("http://www.w3.org/ns/locn#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/log.js
var builder49 = namespace_default("http://www.w3.org/2000/10/swap/log#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/lvont.js
var builder50 = namespace_default("http://lexvo.org/ontology#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/m4i.js
var builder51 = namespace_default("http://w3id.org/nfdi4ing/metadata4ing#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/ma.js
var builder52 = namespace_default("http://www.w3.org/ns/ma-ont#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/mads.js
var builder53 = namespace_default("http://www.loc.gov/mads/rdf/v1#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/math.js
var builder54 = namespace_default("http://www.w3.org/2000/10/swap/math#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/oa.js
var builder55 = namespace_default("http://www.w3.org/ns/oa#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/og.js
var builder56 = namespace_default("http://ogp.me/ns#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/oidc.js
var builder57 = namespace_default("http://www.w3.org/ns/solid/oidc#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/org.js
var builder58 = namespace_default("http://www.w3.org/ns/org#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/owl.js
var builder59 = namespace_default("http://www.w3.org/2002/07/owl#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/pim.js
var builder60 = namespace_default("http://www.w3.org/ns/pim/space#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/prefix.js
var builder61 = namespace_default("http://qudt.org/vocab/prefix/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/prov.js
var builder62 = namespace_default("http://www.w3.org/ns/prov#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/qb.js
var builder63 = namespace_default("http://purl.org/linked-data/cube#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/qkdv.js
var builder64 = namespace_default("http://qudt.org/vocab/dimensionvector/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/quantitykind.js
var builder65 = namespace_default("http://qudt.org/vocab/quantitykind/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/qudt.js
var builder66 = namespace_default("http://qudt.org/schema/qudt/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/rdau.js
var builder67 = namespace_default("http://rdaregistry.info/Elements/u/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/rdf.js
var builder68 = namespace_default("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var strict2 = builder68;

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/rdfa.js
var builder69 = namespace_default("http://www.w3.org/ns/rdfa#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/rdfs.js
var builder70 = namespace_default("http://www.w3.org/2000/01/rdf-schema#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/rev.js
var builder71 = namespace_default("http://purl.org/stuff/rev#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/rico.js
var builder72 = namespace_default("https://www.ica.org/standards/RiC/ontology#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/rr.js
var builder73 = namespace_default("http://www.w3.org/ns/r2rml#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/rss.js
var builder74 = namespace_default("http://purl.org/rss/1.0/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/schema.js
var builder75 = namespace_default("http://schema.org/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/sd.js
var builder76 = namespace_default("http://www.w3.org/ns/sparql-service-description#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/sdmx.js
var builder77 = namespace_default("http://purl.org/linked-data/sdmx#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/sem.js
var builder78 = namespace_default("http://semanticweb.cs.vu.nl/2009/11/sem/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/set.js
var builder79 = namespace_default("http://www.w3.org/2000/10/swap/set#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/sf.js
var builder80 = namespace_default("http://www.opengis.net/ont/sf#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/sh.js
var builder81 = namespace_default("http://www.w3.org/ns/shacl#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/shex.js
var builder82 = namespace_default("http://www.w3.org/ns/shex#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/shsh.js
var builder83 = namespace_default("http://www.w3.org/ns/shacl-shacl#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/sioc.js
var builder84 = namespace_default("http://rdfs.org/sioc/ns#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/skos.js
var builder85 = namespace_default("http://www.w3.org/2004/02/skos/core#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/skosxl.js
var builder86 = namespace_default("http://www.w3.org/2008/05/skos-xl#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/solid.js
var builder87 = namespace_default("http://www.w3.org/ns/solid/terms#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/sosa.js
var builder88 = namespace_default("http://www.w3.org/ns/sosa/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/sou.js
var builder89 = namespace_default("http://qudt.org/vocab/sou/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/ssn.js
var builder90 = namespace_default("http://www.w3.org/ns/ssn/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/stat.js
var builder91 = namespace_default("http://www.w3.org/ns/posix/stat#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/string.js
var builder92 = namespace_default("http://www.w3.org/2000/10/swap/string#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/test.js
var builder93 = namespace_default("http://www.w3.org/2006/03/test-description#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/time.js
var builder94 = namespace_default("http://www.w3.org/2006/time#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/unit.js
var builder95 = namespace_default("http://qudt.org/vocab/unit/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/vaem.js
var builder96 = namespace_default("http://www.linkedmodel.org/schema/vaem#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/vann.js
var builder97 = namespace_default("http://purl.org/vocab/vann/");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/vcard.js
var builder98 = namespace_default("http://www.w3.org/2006/vcard/ns#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/void.js
var builder99 = namespace_default("http://rdfs.org/ns/void#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/vs.js
var builder100 = namespace_default("http://www.w3.org/2003/06/sw-vocab-status/ns#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/vso.js
var builder101 = namespace_default("http://purl.org/vso/ns#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/wdrs.js
var builder102 = namespace_default("http://www.w3.org/2007/05/powder-s#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/wgs.js
var builder103 = namespace_default("http://www.w3.org/2003/01/geo/wgs84_pos#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/xhv.js
var builder104 = namespace_default("http://www.w3.org/1999/xhtml/vocab#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/xkos.js
var builder105 = namespace_default("http://rdf-vocabulary.ddialliance.org/xkos#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/xsd.js
var builder106 = namespace_default("http://www.w3.org/2001/XMLSchema#");
var strict3 = builder106;

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/rif.js
var builder107 = namespace_default("http://www.w3.org/2007/rif#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/v.js
var builder108 = namespace_default("http://rdf.data-vocabulary.org/#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/wdr.js
var builder109 = namespace_default("http://www.w3.org/2007/05/powder#");

// ../../node_modules/.pnpm/@tpluscode+rdf-ns-builders@5.0.0/node_modules/@tpluscode/rdf-ns-builders/vocabularies/xml.js
var builder110 = namespace_default("http://www.w3.org/XML/1998/namespace/");

// ../../node_modules/.pnpm/@rdfjs+term-map@2.0.2/node_modules/@rdfjs/term-map/TermMap.js
var TermMap = class {
  constructor(entries) {
    this.index = /* @__PURE__ */ new Map();
    if (entries) {
      for (const [term2, value] of entries) {
        this.set(term2, value);
      }
    }
  }
  get size() {
    return this.index.size;
  }
  clear() {
    this.index.clear();
  }
  delete(term2) {
    return this.index.delete(to_ntriples_default(term2));
  }
  *entries() {
    for (const [, { term: term2, value }] of this.index) {
      yield [term2, value];
    }
  }
  forEach(callback, thisArg) {
    for (const entry of this.entries()) {
      callback.call(thisArg, entry[1], entry[0], this);
    }
  }
  get(term2) {
    const item = this.index.get(to_ntriples_default(term2));
    return item && item.value;
  }
  has(term2) {
    return this.index.has(to_ntriples_default(term2));
  }
  *keys() {
    for (const [, { term: term2 }] of this.index) {
      yield term2;
    }
  }
  set(term2, value) {
    const key = to_ntriples_default(term2);
    this.index.set(key, { term: term2, value });
    return this;
  }
  *values() {
    for (const [, { value }] of this.index) {
      yield value;
    }
  }
  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }
};
var TermMap_default = TermMap;

// ../../node_modules/.pnpm/rdf-validate-datatype@0.2.2/node_modules/rdf-validate-datatype/src/validators.js
var Registry = class {
  validators;
  constructor() {
    this.validators = new TermMap_default();
  }
  /**
   * Register a new validator for a specific datatype.
   */
  register(datatype, validatorFunc) {
    this.validators.set(datatype, validatorFunc);
  }
  /**
   * Find validator for a given datatype.
   */
  find(datatype) {
    if (!datatype) {
      return null;
    }
    return this.validators.get(datatype);
  }
};
var validators = new Registry();
validators.register(strict3.anySimpleType, () => true);
validators.register(strict3.anyAtomicType, () => true);
validators.register(strict3.string, () => true);
validators.register(strict3.normalizedString, (value) => isNormalized(value));
validators.register(strict3.token, (value) => isNormalized(value) && !value.startsWith(" ") && !value.endsWith(" ") && !value.includes("  "));
function isNormalized(value) {
  const forbiddenChars = ["\n", "\r", "	"];
  return !forbiddenChars.some((forbiddenChar) => value.includes(forbiddenChar));
}
var languagePattern = /^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/;
validators.register(strict3.language, (value) => languagePattern.test(value));
var anyURIPattern = /^[^\ufffe\uffff]*$/;
validators.register(strict3.anyURI, (value) => anyURIPattern.test(value));
var signSeg = "(\\+|-)?";
var integerPattern = new RegExp(`^${signSeg}\\d+$`);
validators.register(strict3.integer, (value) => integerPattern.test(value));
validators.register(strict3.nonNegativeInteger, (value) => integerPattern.test(value) && BigInt(value) >= BigInt("0"));
validators.register(strict3.positiveInteger, (value) => integerPattern.test(value) && BigInt(value) > BigInt("0"));
validators.register(strict3.nonPositiveInteger, (value) => integerPattern.test(value) && BigInt(value) <= BigInt("0"));
validators.register(strict3.negativeInteger, (value) => integerPattern.test(value) && BigInt(value) < BigInt("0"));
validators.register(strict3.int, (value) => integerPattern.test(value) && BigInt(value) >= BigInt("-2147483647") && BigInt(value) <= BigInt("2147483648"));
validators.register(strict3.unsignedInt, (value) => integerPattern.test(value) && BigInt(value) >= BigInt("0") && BigInt(value) <= BigInt("4294967295"));
validators.register(strict3.long, (value) => integerPattern.test(value) && BigInt(value) >= BigInt("-9223372036854775808") && BigInt(value) <= BigInt("9223372036854775807"));
validators.register(strict3.unsignedLong, (value) => integerPattern.test(value) && BigInt(value) >= BigInt("0") && BigInt(value) <= BigInt("18446744073709551615"));
validators.register(strict3.short, (value) => integerPattern.test(value) && BigInt(value) >= BigInt("-32768") && BigInt(value) <= BigInt("32767"));
validators.register(strict3.unsignedShort, (value) => integerPattern.test(value) && BigInt(value) >= BigInt("0") && BigInt(value) <= BigInt("65535"));
validators.register(strict3.byte, (value) => integerPattern.test(value) && BigInt(value) >= BigInt("-128") && BigInt(value) <= BigInt("127"));
validators.register(strict3.unsignedByte, (value) => integerPattern.test(value) && BigInt(value) >= BigInt("0") && BigInt(value) <= BigInt("255"));
validators.register(strict3.boolean, (value) => value === "1" || value === "true" || value === "0" || value === "false");
var decimalSeg = `${signSeg}(\\d+\\.?\\d*|\\.\\d+)`;
var decimalPattern = new RegExp(`^${signSeg}${decimalSeg}$`);
validators.register(strict3.decimal, (value) => decimalPattern.test(value));
validators.register(strict3.float, validateFloat);
validators.register(strict3.double, validateFloat);
var floatPattern = new RegExp(`^${signSeg}${decimalSeg}((E|e)(\\+|-)?\\d+)?$`);
function validateFloat(value) {
  return value === "INF" || value === "-INF" || value === "NaN" || floatPattern.test(value);
}
var dateSignSeg = "-?";
var durationYearSeg = "\\d+Y";
var durationMonthSeg = "\\d+M";
var durationDaySeg = "\\d+D";
var durationHourSeg = "\\d+H";
var durationMinuteSeg = "\\d+M";
var durationSecondSeg = "\\d+(\\.\\d+)?S";
var durationYearMonthSeg = `(${durationYearSeg}(${durationMonthSeg})?|${durationMonthSeg})`;
var durationTimeSeg = `T((${durationHourSeg}(${durationMinuteSeg})?(${durationSecondSeg})?)|(${durationMinuteSeg}(${durationSecondSeg})?)|${durationSecondSeg})`;
var durationDayTimeSeg = `(${durationDaySeg}(${durationTimeSeg})?|${durationTimeSeg})`;
var durationSeg = `${dateSignSeg}P((${durationYearMonthSeg}(${durationDayTimeSeg})?)|${durationDayTimeSeg})`;
var durationPattern = new RegExp(`^${durationSeg}$`);
validators.register(strict3.duration, (value) => durationPattern.test(value));
var dayTimeDurationPattern = new RegExp(`^${dateSignSeg}P${durationDayTimeSeg}$`);
validators.register(strict3.dayTimeDuration, (value) => dayTimeDurationPattern.test(value));
var yearMonthDurationPattern = new RegExp(`^${dateSignSeg}P${durationYearMonthSeg}$`);
validators.register(strict3.yearMonthDuration, (value) => yearMonthDurationPattern.test(value));
var yearSeg = `${dateSignSeg}(([1-9]\\d{3,})|(0\\d{3}))`;
var timezoneSeg = "(((\\+|-)\\d{2}:\\d{2})|Z)";
var monthSeg = "\\d{2}";
var daySeg = "\\d{2}";
var dateSeg = `${yearSeg}-${monthSeg}-${daySeg}`;
var timeSeg = "\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?";
var dateTimePattern = new RegExp(`^${dateSeg}T${timeSeg}${timezoneSeg}?$`);
validators.register(strict3.dateTime, (value) => dateTimePattern.test(value));
var dateTimeStampPattern = new RegExp(`^${dateSeg}T${timeSeg}${timezoneSeg}$`);
validators.register(strict3.dateTimeStamp, (value) => dateTimeStampPattern.test(value));
var datePattern = new RegExp(`^${dateSeg}${timezoneSeg}?$`);
validators.register(strict3.date, (value) => datePattern.test(value));
var dayPattern = new RegExp(`^${daySeg}${timezoneSeg}?$`);
validators.register(strict3.gDay, (value) => dayPattern.test(value));
var monthPattern = new RegExp(`^--${monthSeg}${timezoneSeg}?$`);
validators.register(strict3.gMonth, (value) => monthPattern.test(value));
var monthDayPattern = new RegExp(`^${monthSeg}-${daySeg}${timezoneSeg}?$`);
validators.register(strict3.gMonthDay, (value) => monthDayPattern.test(value));
var yearPattern = new RegExp(`^${yearSeg}${timezoneSeg}?$`);
validators.register(strict3.gYear, (value) => yearPattern.test(value));
var yearMonthPattern = new RegExp(`^${yearSeg}-${monthSeg}${timezoneSeg}?$`);
validators.register(strict3.gYearMonth, (value) => yearMonthPattern.test(value));
var timePattern = new RegExp(`^${timeSeg}${timezoneSeg}?$`);
validators.register(strict3.time, (value) => timePattern.test(value));
var hexBinaryPattern = /^([0-9a-fA-F]{2})*$/;
validators.register(strict3.hexBinary, (value) => hexBinaryPattern.test(value));
var b64CharSeg = "[A-Za-z0-9+/]";
var b16CharSeg = "[AEIMQUYcgkosw048]";
var b04CharSeg = "[AQgw]";
var b64Seg = `(${b64CharSeg} ?)`;
var b16Seg = `(${b16CharSeg} ?)`;
var b04Seg = `(${b04CharSeg} ?)`;
var b64Padded16Seg = `(${b64Seg}{2}${b16Seg}=)`;
var b64Padded8Seg = `(${b64Seg}${b04Seg}= ?=)`;
var b64QuadSeg = `(${b64Seg}{4})`;
var b64FinalQuadSeg = `(${b64Seg}{3}${b64CharSeg})`;
var b64FinalSeg = `(${b64FinalQuadSeg}|${b64Padded16Seg}|${b64Padded8Seg})`;
var b64Pattern = new RegExp(`^(${b64QuadSeg}*${b64FinalSeg})?$`);
validators.register(strict3.base64Binary, (value) => b64Pattern.test(value));
validators.register(strict.JSON, (value) => {
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    return false;
  }
});
validators.register(strict3.NOTATION, () => true);
validators.register(strict3.QName, () => true);
validators.register(strict3.Name, () => true);
validators.register(strict3.NCName, () => true);
validators.register(strict3.ENTITY, () => true);
validators.register(strict3.ID, () => true);
validators.register(strict3.IDREF, () => true);
validators.register(strict3.NMTOKEN, () => true);
validators.register(strict3.ENTITIES, () => true);
validators.register(strict3.IDREFS, () => true);
validators.register(strict3.NMTOKENS, () => true);
validators.register(strict2.XMLLiteral, () => true);
validators.register(strict2.HTML, () => true);

// ../../node_modules/.pnpm/rdf-validate-datatype@0.2.2/node_modules/rdf-validate-datatype/src/validate-term.js
function validateTerm(term2) {
  if (term2.termType !== "Literal") {
    throw new Error("Cannot validate non-literal terms");
  }
  const validator = validators.find(term2.datatype);
  if (validator) {
    return validator(term2.value);
  }
  return true;
}

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/validators.js
var import_rdf_literal = __toESM(require_rdf_literal(), 1);

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/property-path.js
function extractPropertyPath(pathNode, ns2, allowNamedNodeInList) {
  if (pathNode.term.termType === "NamedNode" && !allowNamedNodeInList) {
    return pathNode.term;
  }
  if (pathNode.term.termType === "BlankNode" || pathNode.term.termType === "NamedNode") {
    const first = pathNode.out(ns2.rdf.first).term;
    if (first) {
      const paths = [...pathNode.list()];
      return paths.map((path) => extractPropertyPath(path, ns2, allowNamedNodeInList));
    }
    const alternativePath = pathNode.out(ns2.sh.alternativePath);
    if (alternativePath.term) {
      const paths = [...alternativePath.list()];
      return { or: paths.map((path) => extractPropertyPath(path, ns2, allowNamedNodeInList)) };
    }
    const zeroOrMorePath = pathNode.out(ns2.sh.zeroOrMorePath);
    if (zeroOrMorePath.term) {
      return { zeroOrMore: extractPropertyPath(zeroOrMorePath, ns2, allowNamedNodeInList) };
    }
    const oneOrMorePath = pathNode.out(ns2.sh.oneOrMorePath);
    if (oneOrMorePath.term) {
      return { oneOrMore: extractPropertyPath(oneOrMorePath, ns2, allowNamedNodeInList) };
    }
    const zeroOrOnePath = pathNode.out(ns2.sh.zeroOrOnePath);
    if (zeroOrOnePath.term) {
      return { zeroOrOne: extractPropertyPath(zeroOrOnePath, ns2, allowNamedNodeInList) };
    }
    const inversePath = pathNode.out(ns2.sh.inversePath);
    if (inversePath.term) {
      return { inverse: extractPropertyPath(inversePath, ns2, allowNamedNodeInList) };
    }
    return pathNode.term;
  }
  throw new Error(`Unsupported SHACL path: ${pathNode.term.value}`);
}
function getPathObjects(graph, subject, path) {
  return [...getPathObjectsSet(graph, subject, path)];
}
function getPathObjectsSet(graph, subject, path) {
  if ("termType" in path && path.termType === "NamedNode") {
    return getNamedNodePathObjects(graph, subject, path);
  } else if (Array.isArray(path)) {
    return getSequencePathObjects(graph, subject, path);
  } else if ("or" in path) {
    return getOrPathObjects(graph, subject, path);
  } else if ("inverse" in path) {
    return getInversePathObjects(graph, subject, path);
  } else if ("zeroOrOne" in path) {
    return getZeroOrOnePathObjects(graph, subject, path);
  } else if ("zeroOrMore" in path) {
    return getZeroOrMorePathObjects(graph, subject, path);
  } else if ("oneOrMore" in path) {
    return getOneOrMorePathObjects(graph, subject, path);
  } else {
    throw new Error(`Unsupported path object: ${path}`);
  }
}
function getNamedNodePathObjects(graph, subject, path) {
  return new node_set_default(graph.node(subject).out(path).terms);
}
function getSequencePathObjects(graph, subject, path) {
  let subjects = new node_set_default([subject]);
  for (const pathItem of path) {
    subjects = new node_set_default(flatMap(subjects, (subjectItem) => getPathObjects(graph, subjectItem, pathItem)));
  }
  return subjects;
}
function getOrPathObjects(graph, subject, path) {
  return new node_set_default(flatMap(path.or, (pathItem) => getPathObjects(graph, subject, pathItem)));
}
function getInversePathObjects(graph, subject, path) {
  if (!("termType" in path.inverse) || path.inverse.termType !== "NamedNode") {
    throw new Error("Unsupported: Inverse paths only work for named nodes");
  }
  return new node_set_default(graph.node(subject).in(path.inverse).terms);
}
function getZeroOrOnePathObjects(graph, subject, path) {
  const pathObjects = getPathObjectsSet(graph, subject, path.zeroOrOne);
  pathObjects.add(subject);
  return pathObjects;
}
function getZeroOrMorePathObjects(graph, subject, path) {
  const pathObjects = walkPath(graph, subject, path.zeroOrMore);
  pathObjects.add(subject);
  return pathObjects;
}
function getOneOrMorePathObjects(graph, subject, path) {
  return walkPath(graph, subject, path.oneOrMore);
}
function walkPath(graph, subject, path, visited = new node_set_default()) {
  visited.add(subject);
  const pathValues = getPathObjectsSet(graph, subject, path);
  const deeperValues = flatMap(pathValues, (pathValue) => {
    if (!visited.has(pathValue)) {
      return [...walkPath(graph, pathValue, path, visited)];
    } else {
      return [];
    }
  });
  pathValues.addAll(deeperValues);
  return pathValues;
}
function flatMap(arr, func) {
  return [...arr].reduce((acc, x) => acc.concat(func(x)), []);
}

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/dataset-utils.js
function* extractStructure(dataset2, startNode, visited = new TermSet_default()) {
  if (startNode.termType !== "BlankNode" || visited.has(startNode)) {
    return;
  }
  visited.add(startNode);
  for (const quad2 of dataset2.match(startNode, null, null)) {
    yield quad2;
    yield* extractStructure(dataset2, quad2.object, visited);
  }
}
function* extractSourceShapeStructure(shape, dataset2, startNode, visited = new TermSet_default()) {
  if (startNode.termType !== "BlankNode" || visited.has(startNode)) {
    return;
  }
  const { factory: factory3 } = shape.context;
  const { sh, rdfs } = shape.context.ns;
  const inListSize = (term2) => {
    const inConstraint = shape.constraints.find((x) => term2.equals(x.paramValue));
    return inConstraint?.nodeSet.size || -1;
  };
  visited.add(startNode);
  for (const quad2 of dataset2.match(startNode, null, null)) {
    if (quad2.predicate.equals(sh.in) && inListSize(quad2.object) > 3) {
      const msg = `sh:in has ${inListSize(quad2.object)} elements and has been removed from the report for brevity. Please refer the original shape`;
      yield factory3.quad(quad2.subject, rdfs.comment, factory3.literal(msg));
    } else {
      yield quad2;
      yield* extractSourceShapeStructure(shape, dataset2, quad2.object, visited);
    }
  }
}
function getInstancesOf(cls, ns2) {
  const classes = getSubClassesOf(cls, ns2);
  classes.add(cls.term);
  return [...classes].reduce((acc, classTerm) => {
    const classInstances = cls.node(classTerm).in(ns2.rdf.type).terms;
    acc.addAll(classInstances);
    return acc;
  }, new node_set_default());
}
function getSubClassesOf(cls, ns2) {
  const subclasses = cls.in(ns2.rdfs.subClassOf);
  const transubclasses = subclasses.toArray().reduce((acc, subclass) => {
    const scs = getSubClassesOf(subclass, ns2);
    acc.addAll(scs);
    return acc;
  }, new node_set_default());
  return new node_set_default([...subclasses.terms, ...transubclasses]);
}
function isInstanceOf(instance, cls, ns2) {
  const classes = getSubClassesOf(cls, ns2);
  classes.add(cls.term);
  const types = instance.out(ns2.rdf.type).terms;
  return types.some((type) => classes.has(type));
}
function rdfListToArray(listNode) {
  return [...listNode.list?.() || []].map(({ term: term2 }) => term2);
}

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/validators.js
var validateAnd = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const andNode = constraint.getParameterValue(sh.and);
  const shapes = rdfListToArray(context.$shapes.node(andNode));
  return shapes.every((shape) => {
    if (constraint.shape.isPropertyShape) {
      return context.nodeConformsToShape(focusNode, shape, constraint.pathObject);
    }
    return context.nodeConformsToShape(valueNode, shape);
  });
};
var validateClass = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const classNode = constraint.getParameterValue(sh.class);
  return isInstanceOf(context.$data.node(valueNode), context.$data.node(classNode), context.ns);
};
var validateClosed = function(context, focusNode, valueNode, constraint) {
  const { sh, xsd: xsd2 } = context.ns;
  const closedNode = constraint.getParameterValue(sh.closed);
  const ignoredPropertiesNode = constraint.getParameterValue(sh.ignoredProperties);
  const currentShape = constraint.shape.shapeNode;
  const trueTerm = context.factory.literal("true", xsd2.boolean);
  if (!trueTerm.equals(closedNode)) {
    return;
  }
  const allowed = new node_set_default(context.$shapes.node(currentShape).out(sh.property).out(sh.path).terms.filter((term2) => term2.termType === "NamedNode"));
  if (ignoredPropertiesNode) {
    allowed.addAll(rdfListToArray(context.$shapes.node(ignoredPropertiesNode)));
  }
  const results = [];
  const valueQuads = [...context.$data.dataset.match(valueNode, null, null)];
  valueQuads.filter(({ predicate }) => !allowed.has(predicate)).forEach(({ predicate, object }) => {
    results.push({ path: predicate, value: object });
  });
  return results;
};
var validateDatatype = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const datatypeNode = constraint.getParameterValue(sh.datatype);
  if (valueNode.termType === "Literal") {
    return valueNode.datatype.equals(datatypeNode) && validateTerm(valueNode);
  } else {
    return false;
  }
};
var validateDisjoint = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const disjointNode = constraint.getParameterValue(sh.disjoint);
  return context.$data.dataset.match(focusNode, disjointNode, valueNode).size === 0;
};
var validateEqualsProperty = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const path = constraint.shape.pathObject;
  const equalsNode = constraint.getParameterValue(sh.equals);
  const results = [];
  getPathObjects(context.$data, focusNode, path).forEach((value) => {
    if (context.$data.dataset.match(focusNode, equalsNode, value).size === 0) {
      results.push({ value });
    }
  });
  const equalsQuads = [...context.$data.dataset.match(focusNode, equalsNode, null)];
  equalsQuads.forEach(({ object }) => {
    const value = object;
    if (!getPathObjects(context.$data, focusNode, path).some((pathValue) => pathValue.equals(value))) {
      results.push({ value });
    }
  });
  return results;
};
var validateEqualsNode = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const equalsNode = constraint.getParameterValue(sh.equals);
  const results = [];
  let solutions = 0;
  getPathObjects(context.$data, focusNode, equalsNode).forEach((value) => {
    solutions++;
    if (!value.equals(focusNode)) {
      results.push({ value });
    }
  });
  if (results.length === 0 && solutions === 0) {
    results.push({ value: focusNode });
  }
  return results;
};
var validateHasValueNode = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const hasValueNode = constraint.getParameterValue(sh.hasValue);
  return focusNode.equals(hasValueNode);
};
var validateHasValueProperty = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const path = constraint.shape.pathObject;
  const hasValueNode = constraint.getParameterValue(sh.hasValue);
  return getPathObjects(context.$data, focusNode, path).some((value) => value.equals(hasValueNode));
};
var validateIn = function(context, focusNode, valueNode, constraint) {
  return constraint.nodeSet.has(valueNode);
};
var validateLanguageIn = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  if (valueNode.termType !== "Literal") {
    return false;
  }
  const valueLanguage = valueNode.language;
  if (!valueLanguage || valueLanguage === "") {
    return false;
  }
  const languageInNode = constraint.getParameterValue(sh.languageIn);
  const allowedLanguages = rdfListToArray(context.$shapes.node(languageInNode));
  return allowedLanguages.some((allowedLanguage) => valueLanguage.startsWith(allowedLanguage.value));
};
var validateLessThanProperty = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const valuePath = constraint.shape.pathObject;
  const values = getPathObjects(context.$data, focusNode, valuePath);
  const lessThanNode = constraint.getParameterValue(sh.lessThan);
  const referenceValues = context.$data.node(focusNode).out(lessThanNode).terms;
  const invalidValues = [];
  for (const value of values) {
    for (const referenceValue of referenceValues) {
      const c = compareTerms(value, referenceValue, context.ns);
      if (c === null || c >= 0) {
        invalidValues.push({ value });
      }
    }
  }
  return invalidValues;
};
var validateLessThanOrEqualsProperty = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const valuePath = constraint.shape.pathObject;
  const values = getPathObjects(context.$data, focusNode, valuePath);
  const lessThanOrEqualsNode = constraint.getParameterValue(sh.lessThanOrEquals);
  const referenceValues = context.$data.node(focusNode).out(lessThanOrEqualsNode).terms;
  const invalidValues = [];
  for (const value of values) {
    for (const referenceValue of referenceValues) {
      const c = compareTerms(value, referenceValue, context.ns);
      if (c === null || c > 0) {
        invalidValues.push({ value });
      }
    }
  }
  return invalidValues;
};
var validateMaxCountProperty = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const path = constraint.shape.pathObject;
  const count = getPathObjects(context.$data, focusNode, path).length;
  const maxCountNode = constraint.getParameterValue(sh.maxCount);
  return maxCountNode && count <= Number(maxCountNode.value);
};
var validateMaxExclusive = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const maxExclusiveNode = constraint.getParameterValue(sh.maxExclusive);
  const comp = compareTerms(valueNode, maxExclusiveNode, context.ns);
  return comp !== null && comp < 0;
};
var validateMaxInclusive = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const maxInclusiveNode = constraint.getParameterValue(sh.maxInclusive);
  const comp = compareTerms(valueNode, maxInclusiveNode, context.ns);
  return comp !== null && comp <= 0;
};
var validateMaxLength = function(context, focusNode, valueNode, constraint) {
  if (valueNode.termType === "BlankNode") {
    return false;
  }
  const { sh } = context.ns;
  const maxLengthNode = constraint.getParameterValue(sh.maxLength);
  return valueNode.value.length <= Number(maxLengthNode.value);
};
var validateMinCountProperty = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const path = constraint.pathObject;
  const count = getPathObjects(context.$data, focusNode, path).length;
  const minCountNode = constraint.getParameterValue(sh.minCount);
  return count >= Number(minCountNode.value);
};
var validateMinExclusive = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const minExclusiveNode = constraint.getParameterValue(sh.minExclusive);
  const comp = compareTerms(valueNode, minExclusiveNode, context.ns);
  return comp !== null && comp > 0;
};
var validateMinInclusive = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const minInclusiveNode = constraint.getParameterValue(sh.minInclusive);
  const comp = compareTerms(valueNode, minInclusiveNode, context.ns);
  return comp !== null && comp >= 0;
};
var validateMinLength = function(context, focusNode, valueNode, constraint) {
  if (valueNode.termType === "BlankNode") {
    return false;
  }
  const { sh } = context.ns;
  const minLengthNode = constraint.getParameterValue(sh.minLength);
  return valueNode.value.length >= Number(minLengthNode.value);
};
var validateNodeKind = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const nodeKindNode = constraint.getParameterValue(sh.nodeKind);
  if (valueNode.termType === "BlankNode") {
    return sh.BlankNode.equals(nodeKindNode) || sh.BlankNodeOrIRI.equals(nodeKindNode) || sh.BlankNodeOrLiteral.equals(nodeKindNode);
  } else if (valueNode.termType === "NamedNode") {
    return sh.IRI.equals(nodeKindNode) || sh.BlankNodeOrIRI.equals(nodeKindNode) || sh.IRIOrLiteral.equals(nodeKindNode);
  } else if (valueNode.termType === "Literal") {
    return sh.Literal.equals(nodeKindNode) || sh.BlankNodeOrLiteral.equals(nodeKindNode) || sh.IRIOrLiteral.equals(nodeKindNode);
  }
};
var validateNode = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const nodeNode = constraint.getParameterValue(sh.node);
  return context.validateNodeAgainstShape(valueNode, nodeNode);
};
var validateNot = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const notNode = constraint.getParameterValue(sh.not);
  return !context.nodeConformsToShape(valueNode, notNode);
};
var validateOr = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const orNode = constraint.getParameterValue(sh.or);
  const shapes = rdfListToArray(context.$shapes.node(orNode));
  return shapes.some((shape) => context.nodeConformsToShape(valueNode, shape));
};
var validatePattern = function(context, focusNode, valueNode, constraint) {
  if (valueNode.termType === "BlankNode") {
    return false;
  }
  const { sh } = context.ns;
  const flagsNode = constraint.getParameterValue(sh.flags);
  const patternNode = constraint.getParameterValue(sh.pattern);
  const re = flagsNode ? new RegExp(patternNode.value, flagsNode.value) : new RegExp(patternNode.value);
  return re.test(valueNode.value);
};
var validateQualifiedMaxCountProperty = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const count = validateQualifiedHelper(context, focusNode, constraint);
  const qualifiedMaxCountNode = constraint.getParameterValue(sh.qualifiedMaxCount);
  return qualifiedMaxCountNode.termType === "Literal" && count <= Number(qualifiedMaxCountNode.value);
};
var validateQualifiedMinCountProperty = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const count = validateQualifiedHelper(context, focusNode, constraint);
  const qualifiedMinCountNode = constraint.getParameterValue(sh.qualifiedMinCount);
  return qualifiedMinCountNode.termType === "Literal" && count >= Number(qualifiedMinCountNode.value);
};
function validateQualifiedHelper(context, focusNode, constraint) {
  const { sh, xsd: xsd2 } = context.ns;
  const currentShapeNode = constraint.shape.shapeNode;
  const qualifiedValueShapesDisjointNode = constraint.getParameterValue(sh.qualifiedValueShapesDisjoint);
  const qualifiedValueShapeNode = constraint.getParameterValue(sh.qualifiedValueShape);
  const trueTerm = context.factory.literal("true", xsd2.boolean);
  const siblingShapes = new node_set_default();
  if (trueTerm.equals(qualifiedValueShapesDisjointNode)) {
    const qualifiedSiblingShapes = context.$shapes.node(currentShapeNode).in(sh.property).out(sh.property).out(sh.qualifiedValueShape).filter(({ term: term2 }) => !term2.equals(qualifiedValueShapeNode)).terms;
    siblingShapes.addAll(qualifiedSiblingShapes);
  }
  const path = constraint.shape.pathObject;
  return getPathObjects(context.$data, focusNode, path).filter((value) => context.nodeConformsToShape(value, qualifiedValueShapeNode) && !validateQualifiedConformsToASibling(context, value, [...siblingShapes])).length;
}
function validateQualifiedConformsToASibling(context, value, siblingShapes) {
  for (let i = 0; i < siblingShapes.length; i++) {
    if (context.nodeConformsToShape(value, siblingShapes[i])) {
      return true;
    }
  }
  return false;
}
var validateUniqueLangProperty = function(context, focusNode, valueNode, constraint) {
  const { sh, xsd: xsd2 } = context.ns;
  const uniqueLangNode = constraint.getParameterValue(sh.uniqueLang);
  const trueTerm = context.factory.literal("true", xsd2.boolean);
  if (!trueTerm.equals(uniqueLangNode)) {
    return;
  }
  const path = constraint.shape.pathObject;
  const map = {};
  getPathObjects(context.$data, focusNode, path).forEach((value) => {
    if (value.termType === "Literal" && value.language && value.language !== "") {
      const old = map[value.language];
      if (!old) {
        map[value.language] = 1;
      } else {
        map[value.language] = old + 1;
      }
    }
  });
  const results = [];
  for (const lang in map) {
    if (Object.prototype.hasOwnProperty.call(map, lang)) {
      const count = map[lang];
      if (count > 1) {
        results.push('Language "' + lang + '" has been used by ' + count + " values");
      }
    }
  }
  return results;
};
var validateXone = function(context, focusNode, valueNode, constraint) {
  const { sh } = context.ns;
  const xoneNode = constraint.getParameterValue(sh.xone);
  const shapes = rdfListToArray(context.$shapes.node(xoneNode));
  const conformsCount = shapes.map((shape) => context.nodeConformsToShape(valueNode, shape)).filter(Boolean).length;
  return conformsCount === 1;
};
function compareTerms(term1, term2, ns2) {
  if (!term1 || !term2 || term1.termType !== "Literal" || term2.termType !== "Literal") {
    return null;
  }
  if (hasTimezone(term1, ns2) !== hasTimezone(term2, ns2)) {
    return null;
  }
  const value1 = (0, import_rdf_literal.fromRdf)(term1);
  const value2 = (0, import_rdf_literal.fromRdf)(term2);
  if (typeof value1 !== typeof value2) {
    return null;
  }
  if (typeof value1 === "string") {
    return value1.localeCompare(value2);
  } else {
    return value1 - value2;
  }
}
function hasTimezone(node, ns2) {
  const pattern = /^.*(((\+|-)\d{2}:\d{2})|Z)$/;
  return ns2.xsd.dateTime.equals(node.datatype) && pattern.test(node.value);
}
var validators_default = {
  validateAnd,
  validateClass,
  validateClosed,
  validateDatatype,
  validateDisjoint,
  validateEqualsNode,
  validateEqualsProperty,
  validateHasValueNode,
  validateHasValueProperty,
  validateIn,
  validateLanguageIn,
  validateLessThanProperty,
  validateLessThanOrEqualsProperty,
  validateMaxCountProperty,
  validateMaxExclusive,
  validateMaxInclusive,
  validateMaxLength,
  validateMinCountProperty,
  validateMinExclusive,
  validateMinInclusive,
  validateMinLength,
  validateNode,
  validateNodeKind,
  validateNot,
  validateOr,
  validatePattern,
  validateQualifiedMaxCountProperty,
  validateQualifiedMinCountProperty,
  validateUniqueLangProperty,
  validateXone
};

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/validators-registry.js
var validators_registry_default = {
  [namespaces_default.sh.AndConstraintComponent.value]: {
    validator: {
      func: validators_default.validateAnd
    }
  },
  [namespaces_default.sh.ClassConstraintComponent.value]: {
    validator: {
      func: validators_default.validateClass
    }
  },
  [namespaces_default.sh.ClosedConstraintComponent.value]: {
    validator: {
      func: validators_default.validateClosed,
      message: "Predicate is not allowed (closed shape)"
    }
  },
  [namespaces_default.sh.DatatypeConstraintComponent.value]: {
    validator: {
      func: validators_default.validateDatatype,
      message: "Value does not have datatype {$datatype}"
    }
  },
  [namespaces_default.sh.DisjointConstraintComponent.value]: {
    validator: {
      func: validators_default.validateDisjoint,
      message: "Value node must not also be one of the values of {$disjoint}"
    }
  },
  [namespaces_default.sh.EqualsConstraintComponent.value]: {
    nodeValidator: {
      func: validators_default.validateEqualsNode,
      message: "Must have same values as {$equals}"
    },
    propertyValidator: {
      func: validators_default.validateEqualsProperty,
      message: "Must have same values as {$equals}"
    }
  },
  [namespaces_default.sh.HasValueConstraintComponent.value]: {
    nodeValidator: {
      func: validators_default.validateHasValueNode,
      message: "Value must be {$hasValue}"
    },
    propertyValidator: {
      func: validators_default.validateHasValueProperty,
      message: "Missing expected value {$hasValue}"
    }
  },
  [namespaces_default.sh.InConstraintComponent.value]: {
    validator: {
      func: validators_default.validateIn,
      message: "Value is not one of the allowed values: {$in}"
    }
  },
  [namespaces_default.sh.LanguageInConstraintComponent.value]: {
    validator: {
      func: validators_default.validateLanguageIn,
      message: "Language does not match any of {$languageIn}"
    }
  },
  [namespaces_default.sh.LessThanConstraintComponent.value]: {
    propertyValidator: {
      func: validators_default.validateLessThanProperty,
      message: "Value is not less than value of {$lessThan}"
    }
  },
  [namespaces_default.sh.LessThanOrEqualsConstraintComponent.value]: {
    propertyValidator: {
      func: validators_default.validateLessThanOrEqualsProperty,
      message: "Value is not less than or equal to value of {$lessThanOrEquals}"
    }
  },
  [namespaces_default.sh.MaxCountConstraintComponent.value]: {
    propertyValidator: {
      func: validators_default.validateMaxCountProperty,
      message: "More than {$maxCount} values"
    }
  },
  [namespaces_default.sh.MaxExclusiveConstraintComponent.value]: {
    validator: {
      func: validators_default.validateMaxExclusive,
      message: "Value is not less than {$maxExclusive}"
    }
  },
  [namespaces_default.sh.MaxInclusiveConstraintComponent.value]: {
    validator: {
      func: validators_default.validateMaxInclusive,
      message: "Value is not less than or equal to {$maxInclusive}"
    }
  },
  [namespaces_default.sh.MaxLengthConstraintComponent.value]: {
    validator: {
      func: validators_default.validateMaxLength,
      message: "Value has more than {$maxLength} characters"
    }
  },
  [namespaces_default.sh.MinCountConstraintComponent.value]: {
    propertyValidator: {
      func: validators_default.validateMinCountProperty,
      message: "Less than {$minCount} values"
    }
  },
  [namespaces_default.sh.MinExclusiveConstraintComponent.value]: {
    validator: {
      func: validators_default.validateMinExclusive,
      message: "Value is not greater than {$minExclusive}"
    }
  },
  [namespaces_default.sh.MinInclusiveConstraintComponent.value]: {
    validator: {
      func: validators_default.validateMinInclusive,
      message: "Value is not greater than or equal to {$minInclusive}"
    }
  },
  [namespaces_default.sh.MinLengthConstraintComponent.value]: {
    validator: {
      func: validators_default.validateMinLength,
      message: "Value has less than {$minLength} characters"
    }
  },
  [namespaces_default.sh.NodeConstraintComponent.value]: {
    validator: {
      func: validators_default.validateNode,
      message: "Value does not have shape {$node}"
    }
  },
  [namespaces_default.sh.NodeKindConstraintComponent.value]: {
    validator: {
      func: validators_default.validateNodeKind,
      message: "Value does not have node kind {$nodeKind}"
    }
  },
  [namespaces_default.sh.NotConstraintComponent.value]: {
    validator: {
      func: validators_default.validateNot,
      message: "Value does have shape {$not}"
    }
  },
  [namespaces_default.sh.OrConstraintComponent.value]: {
    validator: {
      func: validators_default.validateOr
    }
  },
  [namespaces_default.sh.PatternConstraintComponent.value]: {
    validator: {
      func: validators_default.validatePattern,
      message: 'Value does not match pattern "{$pattern}"'
    }
  },
  [namespaces_default.sh.QualifiedMaxCountConstraintComponent.value]: {
    propertyValidator: {
      func: validators_default.validateQualifiedMaxCountProperty,
      message: "More than {$qualifiedMaxCount} values have shape {$qualifiedValueShape}"
    }
  },
  [namespaces_default.sh.QualifiedMinCountConstraintComponent.value]: {
    propertyValidator: {
      func: validators_default.validateQualifiedMinCountProperty,
      message: "Less than {$qualifiedMinCount} values have shape {$qualifiedValueShape}"
    }
  },
  [namespaces_default.sh.UniqueLangConstraintComponent.value]: {
    propertyValidator: {
      func: validators_default.validateUniqueLangProperty,
      message: 'Language "{?lang}" used more than once'
    }
  },
  [namespaces_default.sh.XoneConstraintComponent.value]: {
    validator: {
      func: validators_default.validateXone
    }
  }
};

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/shapes-graph.js
var ShapesGraph = class {
  _components;
  _parametersMap;
  _shapes;
  _shapeNodesWithConstraints;
  _shapesWithTarget;
  constructor(context) {
    this.context = context;
    const { sh } = context.ns;
    const shaclVocabulary = context.factory.clownface({
      dataset: context.factory.dataset(sh_default(context))
    });
    const componentNodes = getInstancesOf(shaclVocabulary.node(sh.ConstraintComponent), context.ns);
    this._components = [...componentNodes].map((node) => new ConstraintComponent(node, context, shaclVocabulary));
    this._parametersMap = /* @__PURE__ */ new Map();
    for (const component of this._components) {
      for (const parameter of component.parameters) {
        this._parametersMap.set(parameter.value, component);
      }
    }
    this._shapes = /* @__PURE__ */ new Map();
  }
  getComponentWithParameter(parameter) {
    return this._parametersMap.get(parameter.value);
  }
  getShape(shapeNode) {
    if (!this._shapes.has(shapeNode.value)) {
      const shape = new Shape(this.context, shapeNode);
      this._shapes.set(shapeNode.value, shape);
    }
    return this._shapes.get(shapeNode.value);
  }
  get shapeNodesWithConstraints() {
    if (!this._shapeNodesWithConstraints) {
      const set = new node_set_default();
      for (const component of this._components) {
        const params = component.requiredParameters;
        for (const param of params) {
          const shapesWithParam = [...this.context.$shapes.dataset.match(null, param, null)].map(({ subject }) => subject);
          set.addAll(shapesWithParam);
        }
      }
      this._shapeNodesWithConstraints = [...set];
    }
    return this._shapeNodesWithConstraints;
  }
  get shapesWithTarget() {
    const { $shapes, ns: ns2 } = this.context;
    const { rdfs, sh } = ns2;
    if (!this._shapesWithTarget) {
      this._shapesWithTarget = this.shapeNodesWithConstraints.filter((shapeNode) => isInstanceOf($shapes.node(shapeNode), $shapes.node(rdfs.Class), ns2) || $shapes.node(shapeNode).out([
        sh.targetClass,
        sh.targetNode,
        sh.targetSubjectsOf,
        sh.targetObjectsOf,
        sh.target
      ]).terms.length > 0).map((shapeNode) => this.getShape(shapeNode));
    }
    return this._shapesWithTarget;
  }
};
var Constraint = class {
  inNodeSet;
  constructor(shape, component, paramValue, shapesGraph) {
    this.shape = shape;
    this.component = component;
    this.paramValue = paramValue;
    this.shapeNodePointer = shapesGraph.node(shape.shapeNode);
  }
  getParameterValue(param) {
    return this.paramValue || this.shapeNodePointer.out(param).term;
  }
  get pathObject() {
    return this.shape.pathObject;
  }
  get validationFunction() {
    return this.shape.isPropertyShape ? this.component.propertyValidationFunction : this.component.nodeValidationFunction;
  }
  get isValidationFunctionGeneric() {
    return this.shape.isPropertyShape ? this.component.propertyValidationFunctionGeneric : this.component.nodeValidationFunctionGeneric;
  }
  get componentMessages() {
    return this.component.getMessages(this.shape);
  }
  get nodeSet() {
    const { sh } = this.shape.context.ns;
    if (!this.inNodeSet) {
      this.inNodeSet = new node_set_default(rdfListToArray(this.shapeNodePointer.out(sh.in)));
    }
    return this.inNodeSet;
  }
};
var ConstraintComponent = class {
  constructor(node, context, shaclVocabulary) {
    const { factory: factory3, ns: ns2 } = context;
    const { sh, xsd: xsd2 } = ns2;
    this.context = context;
    this.node = node;
    this.nodePointer = shaclVocabulary.node(node);
    this.parameters = [];
    this.parameterNodes = [];
    this.requiredParameters = [];
    this.optionals = {};
    const trueTerm = factory3.literal("true", xsd2.boolean);
    this.nodePointer.out(sh.parameter).forEach((parameterCf) => {
      const parameter = parameterCf.term;
      parameterCf.out(sh.path).forEach(({ term: path }) => {
        this.parameters.push(path);
        this.parameterNodes.push(parameter);
        if (shaclVocabulary.dataset.match(parameter, sh.optional, trueTerm).size > 0) {
          this.optionals[path.value] = true;
        } else {
          this.requiredParameters.push(path);
        }
      });
    });
    this.nodeValidationFunction = this.findValidationFunction(sh.nodeValidator);
    if (!this.nodeValidationFunction) {
      this.nodeValidationFunction = this.findValidationFunction(sh.validator);
      this.nodeValidationFunctionGeneric = true;
    }
    this.propertyValidationFunction = this.findValidationFunction(sh.propertyValidator);
    if (!this.propertyValidationFunction) {
      this.propertyValidationFunction = this.findValidationFunction(sh.validator);
      this.propertyValidationFunctionGeneric = true;
    }
  }
  findValidationFunction(predicate) {
    const validatorType = predicate.value.split("#").slice(-1)[0];
    const validator = this.findValidator(validatorType);
    if (!validator)
      return null;
    return new validation_function_default(this.context, validator.func.name, validator.func);
  }
  getMessages(shape) {
    const generic = shape.isPropertyShape ? this.propertyValidationFunctionGeneric : this.nodeValidationFunctionGeneric;
    const validatorType = generic ? "validator" : shape.isPropertyShape ? "propertyValidator" : "nodeValidator";
    const validator = this.findValidator(validatorType);
    if (!validator)
      return [];
    const message = validator.message;
    return message ? [message] : [];
  }
  findValidator(validatorType) {
    const constraintValidators = validators_registry_default[this.node.value];
    if (!constraintValidators)
      return null;
    const validator = constraintValidators[validatorType];
    return validator || null;
  }
  isComplete(shapeNode) {
    return !this.parameters.some((parameter) => this.isRequired(parameter.value) && this.context.$shapes.dataset.match(shapeNode, parameter, null).size === 0);
  }
  isRequired(parameterURI) {
    return !this.optionals[parameterURI];
  }
};
var Shape = class _Shape {
  constructor(context, shapeNode) {
    const { $shapes, ns: ns2, shapesGraph, allowNamedNodeInList: allowNamedNodeSequencePaths } = context;
    const { sh } = ns2;
    this.context = context;
    this.shapeNode = shapeNode;
    this.shapeNodePointer = $shapes.node(shapeNode);
    this.severity = this.shapeNodePointer.out(sh.severity).term || sh.Violation;
    this.deactivated = this.shapeNodePointer.out(sh.deactivated).value === "true";
    this.pathObject = null;
    const path = this.shapeNodePointer.out(sh.path);
    if (path.term) {
      this.path = path;
      this.pathObject = extractPropertyPath(this.path, ns2, allowNamedNodeSequencePaths);
    }
    this.constraints = [];
    const handled = new node_set_default();
    const shapeProperties = [...$shapes.dataset.match(shapeNode, null, null)];
    shapeProperties.forEach((sol) => {
      const component = shapesGraph.getComponentWithParameter(sol.predicate);
      if (component && !handled.has(component.node)) {
        const params = component.parameters;
        if (params.length === 1) {
          this.constraints.push(new Constraint(this, component, sol.object, $shapes));
        } else if (component.isComplete(shapeNode)) {
          this.constraints.push(new Constraint(this, component, void 0, $shapes));
          handled.add(component.node);
        }
      }
    });
  }
  get isPropertyShape() {
    return this.pathObject != null;
  }
  overridePath(path) {
    const shape = new _Shape(this.context, this.shapeNode);
    shape.pathObject = path;
    return shape;
  }
  getTargetNodes(dataGraph) {
    const { $shapes, ns: ns2 } = this.context;
    const { rdfs, sh } = ns2;
    const results = new node_set_default();
    if (isInstanceOf($shapes.node(this.shapeNode), $shapes.node(rdfs.Class), ns2)) {
      results.addAll(getInstancesOf(dataGraph.node(this.shapeNode), ns2));
    }
    const targetClasses = [...$shapes.dataset.match(this.shapeNode, sh.targetClass, null)];
    targetClasses.forEach(({ object: targetClass }) => {
      results.addAll(getInstancesOf(dataGraph.node(targetClass), ns2));
    });
    const targetNodes = this.shapeNodePointer.out(sh.targetNode).terms.filter((targetNode) => dataGraph.dataset.match(targetNode).size > 0 || dataGraph.dataset.match(null, targetNode).size > 0 || dataGraph.dataset.match(null, null, targetNode).size > 0);
    results.addAll(targetNodes);
    this.shapeNodePointer.out(sh.targetSubjectsOf).terms.forEach((predicate) => {
      const subjects = [...dataGraph.dataset.match(null, predicate, null)].map(({ subject }) => subject);
      results.addAll(subjects);
    });
    this.shapeNodePointer.out(sh.targetObjectsOf).terms.forEach((predicate) => {
      const objects = [...dataGraph.dataset.match(null, predicate, null)].map(({ object }) => object);
      results.addAll(objects);
    });
    return [...results];
  }
  getValueNodes(focusNode, dataGraph) {
    if (this.pathObject) {
      return getPathObjects(dataGraph, focusNode, this.pathObject);
    } else {
      return [focusNode];
    }
  }
};
var shapes_graph_default = ShapesGraph;

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/validation-engine.js
var import_debug = __toESM(require_src(), 1);

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/validation-report.js
var ValidationReport = class {
  constructor(pointer, options = {}) {
    this.factory = options.factory || defaultEnv_default;
    this.ns = options.ns || prepareNamespaces(this.factory);
    const { sh, xsd: xsd2 } = this.ns;
    this.pointer = pointer;
    this.term = pointer.term;
    this.dataset = pointer.dataset;
    const resultsPointer = pointer.out(sh.result);
    const conforms = resultsPointer.terms.length === 0;
    pointer.addOut(sh.conforms, this.factory.literal(conforms.toString(), xsd2.boolean));
    this.conforms = conforms;
    this.results = resultsPointer.toArray().map((resultPointer) => new ValidationResult(resultPointer, this.ns));
  }
};
var ValidationResult = class _ValidationResult {
  pointer;
  ns;
  constructor(pointer, ns2) {
    this.pointer = pointer;
    this.ns = ns2;
    this.term = pointer.term;
    this.dataset = pointer.dataset;
  }
  get message() {
    return this.pointer.out(this.ns.sh.resultMessage).terms || [];
  }
  get path() {
    return this.pointer.out(this.ns.sh.resultPath).term || null;
  }
  get focusNode() {
    return this.pointer.out(this.ns.sh.focusNode).term || null;
  }
  get severity() {
    return this.pointer.out(this.ns.sh.resultSeverity).term || null;
  }
  get sourceConstraintComponent() {
    return this.pointer.out(this.ns.sh.sourceConstraintComponent).term || null;
  }
  get sourceShape() {
    return this.pointer.out(this.ns.sh.sourceShape).term || null;
  }
  get value() {
    return this.pointer.out(this.ns.sh.value).term || null;
  }
  get detail() {
    return this.pointer.out(this.ns.sh.detail).map((detailResult) => new _ValidationResult(detailResult, this.ns));
  }
};
var validation_report_default = ValidationReport;

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/src/validation-engine.js
var error = (0, import_debug.default)("validation-engine::error");
var defaultMaxNodeChecks = 50;
var ValidationEngine = class _ValidationEngine {
  constructor(context, options) {
    this.context = context;
    this.factory = context.factory;
    this.maxErrors = options.maxErrors;
    this.maxNodeChecks = options.maxNodeChecks === void 0 ? defaultMaxNodeChecks : options.maxNodeChecks;
    this.initReport();
    this.recordErrorsLevel = options.recordErrorsLevel || 0;
    this.violationsCount = 0;
    this.validationError = null;
    this.nestedResults = options.nestedResults || {};
    this.nodeCheckCounters = {};
    this.reportPointer = this.factory.clownface().blankNode();
  }
  clone({ recordErrorsLevel } = {}) {
    return new _ValidationEngine(this.context, {
      maxErrors: this.maxErrors,
      maxNodeChecks: this.maxNodeChecks,
      recordErrorsLevel
    });
  }
  initReport() {
    const { rdf, sh } = this.context.ns;
    this.nodeCheckCounters = {};
    this.reportPointer = this.factory.clownface({
      term: this.factory.blankNode("report")
    }).addOut(rdf.type, sh.ValidationReport);
  }
  /**
   * Validates the data graph against the shapes graph
   */
  validateAll(dataGraph) {
    if (this.maxErrorsReached())
      return true;
    this.validationError = null;
    try {
      this.initReport();
      let foundError = false;
      const shapes = this.context.shapesGraph.shapesWithTarget;
      for (const shape of shapes) {
        const focusNodes = shape.getTargetNodes(dataGraph);
        for (const focusNode of focusNodes) {
          if (this.validateNodeAgainstShape(focusNode, shape, dataGraph)) {
            foundError = true;
          }
        }
      }
      return foundError;
    } catch (e) {
      this.validationError = e;
      return true;
    }
  }
  /**
   * Returns true if any violation has been found
   */
  validateNodeAgainstShape(focusNode, shape, dataGraph) {
    if (this.maxErrorsReached())
      return true;
    if (shape.deactivated)
      return false;
    if (this.maxNodeChecks > 0) {
      const id = JSON.stringify([focusNode, shape.shapeNode]);
      const nodeCheckCounter = this.nodeCheckCounters[id] === void 0 ? 0 : this.nodeCheckCounters[id];
      if (nodeCheckCounter > this.maxNodeChecks) {
        return false;
      }
      this.nodeCheckCounters[id] = nodeCheckCounter + 1;
    }
    const valueNodes = shape.getValueNodes(focusNode, dataGraph);
    let errorFound = false;
    for (const constraint of shape.constraints) {
      if (this.validateNodeAgainstConstraint(focusNode, valueNodes, constraint, dataGraph)) {
        errorFound = true;
      }
    }
    return errorFound;
  }
  validateNodeAgainstConstraint(focusNode, valueNodes, constraint, dataGraph) {
    const { sh } = this.context.ns;
    if (this.maxErrorsReached())
      return true;
    if (sh.PropertyConstraintComponent.equals(constraint.component.node)) {
      let errorFound = false;
      for (const valueNode of valueNodes) {
        if (this.validateNodeAgainstShape(valueNode, this.context.shapesGraph.getShape(constraint.paramValue), dataGraph)) {
          errorFound = true;
        }
      }
      return errorFound;
    }
    if (!constraint.validationFunction) {
      throw new Error("Cannot find validator for constraint component " + constraint.component.node.value);
    }
    if (constraint.isValidationFunctionGeneric) {
      let errorFound = false;
      for (const valueNode of valueNodes) {
        if (this.maxErrorsReached()) {
          break;
        }
        const valueNodeError = this.validateValueNodeAgainstConstraint(focusNode, valueNode, constraint);
        if (valueNodeError) {
          this.violationsCount++;
        }
        errorFound = errorFound || valueNodeError;
      }
      return errorFound;
    } else {
      return this.validateValueNodeAgainstConstraint(focusNode, null, constraint);
    }
  }
  validateValueNodeAgainstConstraint(focusNode, valueNode, constraint) {
    const { sh } = this.context.ns;
    this.recordErrorsLevel++;
    const validationOutput = constraint.validationFunction?.execute(focusNode, valueNode, constraint);
    const validationResults = Array.isArray(validationOutput) ? validationOutput : [validationOutput];
    const results = validationResults.map((validationResult) => this.createResultFromObject(validationResult, constraint, focusNode, valueNode)).filter(Boolean);
    if (this.recordErrorsLevel === 1) {
      for (const result of results) {
        copyResult(result, this.reportPointer, sh.result);
      }
    } else {
      this.nestedResults[this.recordErrorsLevel] = (this.nestedResults[this.recordErrorsLevel] || []).concat(results);
    }
    this.recordErrorsLevel--;
    return results.length > 0;
  }
  maxErrorsReached() {
    if (this.maxErrors) {
      return this.violationsCount >= this.maxErrors;
    } else {
      return false;
    }
  }
  getReport() {
    if (this.validationError) {
      error("Validation Failure: " + this.validationError);
      throw this.validationError;
    } else {
      return new validation_report_default(this.reportPointer, { factory: this.factory, ns: this.context.ns });
    }
  }
  /**
   * Creates all the validation result nodes and messages for the result of applying the validation logic
   * of a constraints against a node.
   * Result passed as the first argument can be false, a resultMessage or a validation result object.
   * If none of these values is passed no error result or error message will be created.
   */
  createResultFromObject(validationResult, constraint, focusNode, valueNode) {
    const { sh } = this.context.ns;
    const validationResultObj = this.normalizeValidationResult(validationResult, valueNode);
    if (!validationResultObj) {
      return null;
    }
    const result = this.createResult(constraint, focusNode);
    if (validationResultObj.path) {
      result.addOut(sh.resultPath, validationResultObj.path);
      this.copyNestedStructure(validationResultObj.path, result);
    } else if (constraint.shape.isPropertyShape && constraint.shape.path?.term) {
      result.addOut(sh.resultPath, constraint.shape.path);
      this.copyNestedStructure(constraint.shape.path.term, result);
    }
    if (validationResultObj.value) {
      result.addOut(sh.value, validationResultObj.value);
      this.copyNestedStructure(validationResultObj.value, result);
    } else if (valueNode) {
      result.addOut(sh.value, valueNode);
      this.copyNestedStructure(valueNode, result);
    }
    const messages = this.createResultMessages(validationResultObj, constraint);
    for (const message of messages) {
      result.addOut(sh.resultMessage, message);
    }
    return result;
  }
  /**
   * Validators can return a boolean, a string (message) or a validation result object.
   * This function normalizes all of them as a validation result object.
   * @returns null if validation was successful.
   */
  normalizeValidationResult(validationResult, valueNode) {
    if (validationResult === false) {
      return { value: valueNode };
    } else if (typeof validationResult === "string") {
      return { message: validationResult, value: valueNode };
    } else if (typeof validationResult === "object") {
      return validationResult;
    } else {
      return null;
    }
  }
  /**
   * Creates a new BlankNode holding the SHACL validation result, adding the default
   * properties for the constraint, focused node and value node
   */
  createResult(constraint, focusNode) {
    const { rdf, sh } = this.context.ns;
    const severity = constraint.shape.severity;
    const sourceConstraintComponent = constraint.component.node;
    const sourceShape = constraint.shape.shapeNode;
    const result = this.factory.clownface().blankNode();
    result.addOut(rdf.type, sh.ValidationResult).addOut(sh.resultSeverity, severity).addOut(sh.sourceConstraintComponent, sourceConstraintComponent).addOut(sh.sourceShape, sourceShape).addOut(sh.focusNode, focusNode);
    this.copySourceShapeStructure(constraint.shape, result);
    this.copyNestedStructure(focusNode, result);
    const children = this.nestedResults[this.recordErrorsLevel + 1];
    if (children) {
      if (sourceConstraintComponent.equals(sh.NodeConstraintComponent)) {
        for (const child of children) {
          copyResult(child, result, sh.detail);
        }
      } else {
      }
      this.nestedResults[this.recordErrorsLevel + 1] = [];
    }
    return result;
  }
  copyNestedStructure(subject, result) {
    const structureQuads = extractStructure(this.context.$shapes.dataset, subject);
    for (const quad2 of structureQuads) {
      result.dataset.add(quad2);
    }
  }
  copySourceShapeStructure(shape, result) {
    const structureQuads = extractSourceShapeStructure(shape, this.context.$shapes.dataset, shape.shapeNode);
    for (const quad2 of structureQuads) {
      result.dataset.add(quad2);
    }
  }
  /**
   * Creates a result message from the validation result and the message pattern in the constraint
   */
  createResultMessages(validationResult, constraint) {
    const { $shapes, ns: ns2 } = this.context;
    const { sh } = ns2;
    let messages = [];
    if (validationResult.message) {
      messages = [this.factory.literal(validationResult.message)];
    }
    if (messages.length === 0) {
      messages = $shapes.node(constraint.shape.shapeNode).out(sh.message).terms;
    }
    if (messages.length === 0) {
      messages = constraint.componentMessages.map((m) => this.factory.literal(m));
    }
    if (messages.length === 0) {
      messages = $shapes.node(constraint.component.node).out(sh.message).terms;
    }
    return messages.map((message) => withSubstitutions(message, constraint, this.factory));
  }
};
function localName(uri) {
  let index = uri.lastIndexOf("#");
  if (index < 0) {
    index = uri.lastIndexOf("/");
  }
  if (index < 0) {
    throw new Error(`Cannot get local name of ${uri}`);
  }
  return uri.substring(index + 1);
}
function* take(n, iterable) {
  let i = 0;
  for (const item of iterable) {
    if (i++ === n)
      break;
    yield item;
  }
}
function nodeLabel(constraint, param) {
  const node = constraint.getParameterValue(param);
  if (!node) {
    return "NULL";
  }
  if (node.termType === "NamedNode") {
    return "<" + node.value + ">";
  }
  if (node.termType === "BlankNode") {
    if (constraint.nodeSet) {
      const limit = 3;
      if (constraint.nodeSet.size > limit) {
        const prefix = Array.from(take(limit, constraint.nodeSet)).map((x) => x.value);
        return prefix.join(", ") + ` ... (and ${constraint.nodeSet.size - limit} more)`;
      } else {
        return Array.from(constraint.nodeSet).map((x) => x.value).join(", ");
      }
    }
    return "Blank node " + node.value;
  }
  return node.value;
}
function withSubstitutions(messageTerm, constraint, factory3) {
  const message = constraint.component.parameters.reduce((message2, param) => {
    const paramName = localName(param.value);
    const paramValue = nodeLabel(constraint, param);
    return message2.replace(`{$${paramName}}`, paramValue).replace(`{?${paramName}}`, paramValue);
  }, messageTerm.value);
  return factory3.literal(message, messageTerm.language || messageTerm.datatype);
}
function copyResult(resultPointer, targetPointer, predicate) {
  for (const quad2 of resultPointer.dataset) {
    targetPointer.dataset.add(quad2);
  }
  targetPointer.addOut(predicate, resultPointer);
}
var validation_engine_default = ValidationEngine;

// ../../node_modules/.pnpm/rdf-validate-shacl@0.5.10/node_modules/rdf-validate-shacl/index.js
var SHACLValidator = class {
  /**
   * @param shapes - Dataset containing the SHACL shapes for validation
   * @param {object} [options] - Validator options
   */
  constructor(shapes, options) {
    options = options || {};
    this.factory = options.factory || defaultEnv_default;
    this.ns = prepareNamespaces(this.factory);
    this.allowNamedNodeInList = options.allowNamedNodeInList === void 0 ? false : options.allowNamedNodeInList;
    const dataset2 = this.factory.dataset([...shapes]);
    this.$shapes = this.factory.clownface({ dataset: dataset2 });
    this.$data = this.factory.clownface();
    this.shapesGraph = new shapes_graph_default(this);
    this.validationEngine = new validation_engine_default(this, options);
    this.depth = 0;
  }
  /**
   * Validates the provided data graph against the provided shapes graph
   */
  validate(dataGraph) {
    this.setDataGraph(dataGraph);
    this.validationEngine.validateAll(this.$data);
    return this.validationEngine.getReport();
  }
  /**
   * Validates the provided focus node against the provided shape
   */
  validateNode(dataGraph, focusNode, shapeNode) {
    this.setDataGraph(dataGraph);
    this.nodeConformsToShape(focusNode, shapeNode, this.validationEngine);
    return this.validationEngine.getReport();
  }
  setDataGraph(dataGraph) {
    if ("dataset" in dataGraph) {
      this.$data = dataGraph;
    } else {
      this.$data = this.factory.clownface({ dataset: dataGraph });
    }
  }
  /**
   * Exposed to be available from validation functions as `SHACL.nodeConformsToShape`
   */
  nodeConformsToShape(focusNode, shapeNode, propertyPathOrEngine) {
    let engine;
    let shape = this.shapesGraph?.getShape(shapeNode);
    if (propertyPathOrEngine && "termType" in propertyPathOrEngine) {
      engine = this.validationEngine.clone({
        recordErrorsLevel: this.validationEngine.recordErrorsLevel
      });
      shape = shape.overridePath(propertyPathOrEngine);
    } else if (propertyPathOrEngine && "clone" in propertyPathOrEngine) {
      engine = propertyPathOrEngine;
    } else {
      engine = this.validationEngine.clone();
    }
    try {
      this.depth++;
      const foundViolations = engine.validateNodeAgainstShape(focusNode, shape, this.$data);
      return !foundViolations;
    } finally {
      this.depth--;
    }
  }
  validateNodeAgainstShape(focusNode, shapeNode) {
    return this.nodeConformsToShape(focusNode, shapeNode, this.validationEngine);
  }
};
var rdf_validate_shacl_default = SHACLValidator;

// ../predicate-reasoner/src/shacl.ts
function parseTurtle(ttl) {
  const store = new import_n3.Store();
  store.addQuads(new import_n3.Parser().parse(ttl));
  return store;
}
async function runShacl(dataTtl, shapesTtl) {
  const data = parseTurtle(dataTtl);
  const shapes = parseTurtle(shapesTtl);
  const validator = new rdf_validate_shacl_default(shapes, {});
  const report = validator.validate(data);
  const violations = report.results.map((r) => ({
    focusNode: r.focusNode?.value ?? "",
    resultPath: r.path?.value,
    message: r.message?.[0]?.value ?? "(no message)",
    sourceShape: r.sourceShape?.value
  }));
  return { ok: report.conforms, violations };
}

// ../predicate-reasoner/src/validate.ts
async function fetchTurtle(client, graph) {
  const r = await client.select(`
    SELECT ?s ?p ?o WHERE { GRAPH <${graph}> { ?s ?p ?o } } LIMIT 100000
  `);
  return r.results.bindings.map((b) => {
    const s = b.s.type === "uri" ? `<${b.s.value}>` : `_:${b.s.value}`;
    const p = `<${b.p.value}>`;
    const o = b.o.type === "uri" ? `<${b.o.value}>` : b.o.type === "bnode" ? `_:${b.o.value}` : `"${b.o.value.replace(/"/g, '\\"')}"`;
    return `${s} ${p} ${o} .`;
  }).join("\n");
}
async function runValidation(client, input) {
  const sandboxInferred = `kg:inferred-validate-${Date.now()}`;
  const adapter = new FusekiConstructAdapter(client);
  const tboxView = `kg:tbox-view-${Date.now()}`;
  await client.update(`CREATE SILENT GRAPH <${tboxView}>`);
  await client.update(`COPY SILENT GRAPH <${input.tboxGraph}>   TO GRAPH <${tboxView}>`);
  await client.update(`ADD SILENT GRAPH  <${input.stagingGraph}> TO GRAPH <${tboxView}>`);
  try {
    const m = await adapter.materialize({
      tboxGraph: tboxView,
      aboxGraphs: [input.aboxSample],
      targetGraph: sandboxInferred,
      closureCutoff: 0.5
    });
    const unsatisfiable = await unsatisfiableClasses(client, tboxView, sandboxInferred);
    const dataTtl = await fetchTurtle(client, input.aboxSample) + "\n" + await fetchTurtle(client, sandboxInferred);
    const shapesTtl = await fetchTurtle(client, tboxView);
    const shacl = await runShacl(dataTtl, shapesTtl);
    const impactedTriples = m.inferredCount;
    const impactedQ = await client.select(`
      SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:usage> { ?q ?p ?o } }
    `);
    const impactedQueries = parseInt(impactedQ.results.bindings[0].n.value, 10);
    return {
      ok: m.inconsistencies.length === 0 && unsatisfiable.length === 0 && shacl.ok,
      unsatisfiableClasses: unsatisfiable,
      shaclViolations: shacl.violations,
      impactedTriples,
      impactedQueries
    };
  } finally {
    await client.update(`DROP SILENT GRAPH <${sandboxInferred}>`);
    await client.update(`DROP SILENT GRAPH <${tboxView}>`);
  }
}
async function unsatisfiableClasses(client, tboxView, inferred) {
  const r = await client.select(`
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT DISTINCT ?C WHERE {
      {
        # Pattern 1: C is subClassOf both A and B (explicit subClassOf triples)
        { GRAPH <${tboxView}> { ?A owl:disjointWith ?B } }
        {
          { GRAPH <${tboxView}> { ?C rdfs:subClassOf ?A } }
          UNION
          { GRAPH <${inferred}> { ?C rdfs:subClassOf ?A } }
        }
        {
          { GRAPH <${tboxView}> { ?C rdfs:subClassOf ?B } }
          UNION
          { GRAPH <${inferred}> { ?C rdfs:subClassOf ?B } }
        }
        FILTER (?A != ?B)
      }
      UNION
      {
        # Pattern 2: C itself is declared disjoint with D,
        # and C rdfs:subClassOf D (C=A in the disjoint pair, subClassOf makes it unsatisfiable)
        { GRAPH <${tboxView}> { ?C owl:disjointWith ?D } }
        {
          { GRAPH <${tboxView}> { ?C rdfs:subClassOf ?D } }
          UNION
          { GRAPH <${inferred}> { ?C rdfs:subClassOf ?D } }
        }
        FILTER (?C != ?D)
      }
      UNION
      {
        # Pattern 3: C is disjoint with D (D declared disjoint with C),
        # and C rdfs:subClassOf D
        { GRAPH <${tboxView}> { ?D owl:disjointWith ?C } }
        {
          { GRAPH <${tboxView}> { ?C rdfs:subClassOf ?D } }
          UNION
          { GRAPH <${inferred}> { ?C rdfs:subClassOf ?D } }
        }
        FILTER (?C != ?D)
      }
    }
  `);
  return r.results.bindings.map((b) => b.C.value);
}

// ../predicate-reasoner/src/explain.ts
var META3 = "https://predicate.dev/meta#";
var MAX_DEPTH = 8;
function quadKey(q) {
  const o = typeof q.o === "string" ? q.o : q.o.value;
  return `${q.s}|${q.p}|${o}`;
}
async function isAsserted(client, q) {
  const o = typeof q.o === "string" ? `<${q.o}>` : `"${q.o.value}"`;
  return client.ask(`
    ASK {
      {
        GRAPH <kg:abox>  { <${q.s}> <${q.p}> ${o} }
      } UNION {
        GRAPH <kg:tbox>  { <${q.s}> <${q.p}> ${o} }
      }
    }
  `);
}
async function getProvenance(client, q) {
  const o = typeof q.o === "string" ? `<${q.o}>` : `"${q.o.value}"`;
  const r = await client.select(`
    PREFIX pred: <${META3}>
    SELECT ?src ?conf ?method ?ts WHERE {
      GRAPH <kg:provenance> {
        << <${q.s}> <${q.p}> ${o} >> pred:source ?src ;
                                      pred:confidence ?conf ;
                                      pred:method ?method ;
                                      pred:timestamp ?ts .
      }
    } LIMIT 1
  `);
  const b = r.results.bindings[0];
  if (!b) return null;
  return {
    triple: q,
    source: b.src.value,
    confidence: parseFloat(b.conf.value),
    method: b.method.value,
    timestamp: b.ts.value
  };
}
async function explain(client, rules, claim) {
  const derivation = [];
  const cited = [];
  const visited = /* @__PURE__ */ new Set();
  let alternatesExist = false;
  async function recurse(target, depth) {
    if (depth > MAX_DEPTH) return false;
    const key = quadKey(target);
    if (visited.has(key)) return true;
    visited.add(key);
    if (await isAsserted(client, target)) {
      const prov = await getProvenance(client, target);
      if (prov) cited.push(prov);
      return true;
    }
    for (const rule of rules) {
      if (!rule.backward) continue;
      if (!rule.backward.matches(target)) continue;
      const r = await client.select(rule.backward.premiseQuery(target));
      if (r.results.bindings.length === 0) continue;
      if (r.results.bindings.length > 1) alternatesExist = true;
      const binding = {};
      for (const [k, v] of Object.entries(r.results.bindings[0])) binding[k] = v.value;
      const premises = rule.backward.buildPremises(target, binding);
      const ok2 = (await Promise.all(premises.map((p) => recurse(p, depth + 1)))).every(Boolean);
      if (!ok2) continue;
      derivation.push({ rule: rule.id, premises, conclusion: target });
      return true;
    }
    return false;
  }
  const ok = await recurse(claim, 0);
  if (!ok) return null;
  return { conclusion: claim, derivation, citedProvenance: cited, alternatesExist };
}

// ../predicate-reasoner/src/index.ts
var FusekiConstructAdapter = class {
  constructor(client) {
    this.client = client;
  }
  client;
  /** Override for tests; in production this is the RULES registry. */
  __rules = RULES;
  async materialize(input) {
    const t0 = Date.now();
    const { iterations, inferredCount } = await runFixpoint(this.client, this.__rules, {
      tboxGraph: input.tboxGraph,
      aboxGraphs: input.aboxGraphs,
      inferredGraph: input.targetGraph,
      closureCutoff: input.closureCutoff
    });
    const inconsistencies = await r11.findInconsistencies(this.client, {
      tboxGraph: input.tboxGraph,
      aboxGraphs: input.aboxGraphs,
      inferredGraph: input.targetGraph,
      closureCutoff: input.closureCutoff
    });
    return {
      inferredCount,
      iterations,
      inconsistencies,
      elapsedMs: Date.now() - t0
    };
  }
  async validate(input) {
    return runValidation(this.client, input);
  }
  async explain(claim) {
    return explain(this.client, this.__rules, claim);
  }
};

// ../predicate-agent/src/promotion-sweeper.ts
var META4 = "https://predicate.dev/meta#";
function newEventId2(kind) {
  return `urn:predicate:event:${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function renderTerm2(t) {
  if (t.type === "uri") return escapeIRI(t.value);
  if (t.datatype) return `${escapeLiteral(t.value)}^^${escapeIRI(t.datatype)}`;
  return escapeLiteral(t.value);
}
function tripleSparql2(q) {
  return `${escapeIRI(q.s)} ${escapeIRI(q.p)} ${renderTerm2(q.o)}`;
}
function tripleTurtle(q) {
  return tripleSparql2(q) + " .";
}
var PromotionSweeper = class {
  constructor(client, opts = {}) {
    this.client = client;
    this.useThreshold = opts.useThreshold ?? 3;
    this.promotedDir = opts.promotedDir ?? resolve2(
      import.meta.dirname ?? process.cwd(),
      "..",
      "..",
      "predicate-ontology",
      "tbox",
      "promoted"
    );
    this.reasoner = new FusekiConstructAdapter(client);
  }
  client;
  useThreshold;
  promotedDir;
  reasoner;
  async run() {
    const t0 = Date.now();
    const proposals = await this.listProposals();
    const decisions = [];
    for (const p of proposals) {
      decisions.push(await this.decide(p));
    }
    return { decisions, durationMs: Date.now() - t0 };
  }
  async listProposals() {
    const r = await this.client.select(`
      PREFIX pred: <${META4}>
      SELECT ?id ?kind ?expiresAt ?justification ?parent ?migration WHERE {
        GRAPH <kg:tbox-staging> {
          ?id a pred:Proposal ;
              pred:kind          ?kind ;
              pred:expiresAt     ?expiresAt ;
              pred:justification ?justification .
          OPTIONAL { ?id pred:parent    ?parent    }
          OPTIONAL { ?id pred:migration ?migration }
        }
      }
    `);
    const out = [];
    for (const b of r.results.bindings) {
      const useCount = await this.countUses(b["id"].value);
      out.push({
        id: b["id"].value,
        kind: b["kind"].value,
        expiresAt: b["expiresAt"].value,
        useCount,
        justification: b["justification"].value,
        parent: b["parent"]?.value,
        migration: b["migration"]?.value
      });
    }
    return out;
  }
  async countUses(proposalId) {
    const subjects = await this.client.select(`
      PREFIX pred: <${META4}>
      SELECT DISTINCT ?s WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(proposalId)} .
        }
      }
    `);
    const iris = subjects.results.bindings.map((b) => b["s"].value);
    if (iris.length === 0) return 0;
    const filters = iris.map((iri) => `CONTAINS(?sparql, "${iri}")`).join(" || ");
    const r = await this.client.select(`
      PREFIX pred: <${META4}>
      SELECT (COUNT(*) AS ?n) WHERE {
        GRAPH <kg:usage> {
          ?q a pred:Query ; pred:sparql ?sparql .
          FILTER (${filters})
        }
      }
    `);
    return parseInt(r.results.bindings[0]["n"].value, 10);
  }
  async decide(p) {
    const now = Date.now();
    const exp = new Date(p.expiresAt).getTime();
    if (now > exp && p.useCount < this.useThreshold) {
      await this.rejectExpired(p);
      return { proposalId: p.id, outcome: "rejected-expired", reason: "TTL elapsed before usage gate met" };
    }
    if (p.useCount >= this.useThreshold) {
      const validation = await this.validateProposalInIsolation(p);
      if (!validation.ok) {
        await this.recordValidationFailed(p, validation.reason ?? "validation failed");
        return {
          proposalId: p.id,
          outcome: "rejected-validation",
          reason: validation.reason
        };
      }
      const promoted = await this.promote(p);
      return {
        proposalId: p.id,
        outcome: "promoted",
        turtleFile: promoted.turtleFile,
        tboxVersion: promoted.tboxVersion
      };
    }
    return { proposalId: p.id, outcome: "awaiting" };
  }
  async validateProposalInIsolation(p) {
    const scratch = `kg:tbox-staging-tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await this.client.update(`CREATE SILENT GRAPH <${scratch}>`);
    try {
      await this.client.update(`
        PREFIX pred: <${META4}>
        INSERT { GRAPH <${scratch}> { ?s ?p ?o } }
        WHERE {
          GRAPH <kg:tbox-staging> {
            << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
            ?s ?p ?o .
          }
        }
      `);
      const result = await this.reasoner.validate({
        tboxGraph: "kg:tbox",
        stagingGraph: scratch,
        aboxSample: "kg:abox"
      });
      if (result.ok) return { ok: true };
      const parts = [];
      if (result.unsatisfiableClasses.length) {
        parts.push(`unsatisfiable: ${result.unsatisfiableClasses.join(", ")}`);
      }
      if (result.shaclViolations.length) {
        parts.push(`${result.shaclViolations.length} SHACL violations`);
      }
      return { ok: false, reason: parts.join("; ") || "validation failed" };
    } finally {
      await this.client.update(`DROP SILENT GRAPH <${scratch}>`);
    }
  }
  async rejectExpired(p) {
    await this.client.update(`
      PREFIX pred: <${META4}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      DELETE {
        GRAPH <kg:tbox-staging> {
          ?s ?p ?o .
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ${escapeIRI(p.id)} ?mp ?mo .
        }
      }
      WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ?s ?p ?o .
          OPTIONAL { ${escapeIRI(p.id)} ?mp ?mo }
        }
      }
    `);
    await this.client.update(`
      PREFIX pred: <${META4}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId2("schema-rejected"))} a pred:SchemaRejected ;
            pred:at    "${(/* @__PURE__ */ new Date()).toISOString()}"^^xsd:dateTime ;
            pred:actor "PromotionSweeper" ;
            pred:goal  ${escapeIRI(p.id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({ reason: "expired" }))} .
        }
      }
    `);
  }
  async recordValidationFailed(p, reason) {
    await this.client.update(`
      PREFIX pred: <${META4}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId2("schema-validation-failed"))} a pred:SchemaValidationFailed ;
            pred:at    "${(/* @__PURE__ */ new Date()).toISOString()}"^^xsd:dateTime ;
            pred:actor "PromotionSweeper" ;
            pred:goal  ${escapeIRI(p.id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({ reason }))} .
        }
      }
    `);
  }
  async promote(p) {
    const r = await this.client.select(`
      PREFIX pred: <${META4}>
      SELECT ?s ?p ?o WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ?s ?p ?o .
        }
      }
    `);
    const quads = r.results.bindings.map((b) => {
      const o = b["o"];
      return {
        s: b["s"].value,
        p: b["p"].value,
        o: o.type === "uri" ? { type: "uri", value: o.value } : { type: "literal", value: o.value, datatype: o.datatype }
      };
    });
    const turtleFile = resolve2(this.promotedDir, `${p.id.replace(/[^A-Za-z0-9-]/g, "_")}.ttl`);
    const turtle = quads.map(tripleTurtle).join("\n") + "\n";
    writeFileSync(turtleFile, turtle, "utf8");
    const tboxVersion = `urn:predicate:tbox:v-${Date.now().toString(36)}`;
    const insertSparql = quads.map((q) => tripleSparql2(q) + " .").join("\n");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const promotedEventId = newEventId2("schema-promoted");
    const advancedEventId = newEventId2("tbox-version-advanced");
    const payloadPromoted = escapeLiteral(JSON.stringify({
      kind: p.kind,
      turtleFile,
      tboxVersion,
      useCount: p.useCount
    }));
    const payloadAdvanced = escapeLiteral(JSON.stringify({ proposalId: p.id, turtleFile }));
    await this.client.update(`DROP SILENT GRAPH <kg:inferred>`);
    await this.client.update(`
      PREFIX pred: <${META4}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:tbox> {
          ${insertSparql}
        }
        GRAPH <kg:meta> {
          ${escapeIRI(promotedEventId)} a pred:SchemaPromoted ;
            pred:at    "${now}"^^xsd:dateTime ;
            pred:actor "PromotionSweeper" ;
            pred:goal  ${escapeIRI(p.id)} ;
            pred:payload ${payloadPromoted} .
          ${escapeIRI(advancedEventId)} a pred:TBoxVersionAdvanced ;
            pred:at    "${now}"^^xsd:dateTime ;
            pred:actor "PromotionSweeper" ;
            pred:goal  ${escapeIRI(tboxVersion)} ;
            pred:payload ${payloadAdvanced} .
        }
      }
    `);
    await this.client.update(`
      PREFIX pred: <${META4}>
      DELETE {
        GRAPH <kg:tbox-staging> {
          ?s ?p ?o .
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ${escapeIRI(p.id)} ?mp ?mo .
        }
      }
      WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ?s ?p ?o .
          OPTIONAL { ${escapeIRI(p.id)} ?mp ?mo }
        }
      }
    `);
    return { turtleFile, tboxVersion };
  }
};

// ../predicate-agent/src/generalizer.ts
import { createHash } from "node:crypto";
var RDF_TYPE2 = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
function fingerprintHash(fingerprint) {
  return createHash("sha1").update(fingerprint.join("|")).digest("hex").slice(0, 12);
}
var Generalizer = class {
  constructor(client, opts = {}) {
    this.client = client;
    this.k = opts.k ?? 5;
  }
  client;
  k;
  async run() {
    const t0 = Date.now();
    const subjects = await this.listUntypedSubjects();
    const groups = this.groupByFingerprint(subjects);
    const proposals = [];
    const proposer = new SchemaProposer(this.client);
    for (const [key, members] of groups.entries()) {
      if (members.length < this.k) continue;
      const fingerprint = key.split("|");
      const hash = fingerprintHash(fingerprint);
      const className = `urn:predicate:gen:${hash}`;
      const proposalId = await proposer.propose({
        kind: "add-class",
        add: [{
          s: className,
          p: RDF_TYPE2,
          o: { type: "uri", value: "http://www.w3.org/2002/07/owl#Class" }
        }]
      }, {
        justification: `auto-proposed: ${members.length} untyped instances share predicates [${fingerprint.join(", ")}]`
      });
      proposals.push({ fingerprint, members, proposalId, className });
    }
    return {
      proposals,
      scannedSubjects: subjects.length,
      durationMs: Date.now() - t0
    };
  }
  async listUntypedSubjects() {
    const r = await this.client.select(`
      SELECT ?s (GROUP_CONCAT(DISTINCT ?p; separator="|") AS ?preds)
      WHERE {
        GRAPH <kg:abox> {
          ?s ?p ?o .
          FILTER (?p != <${RDF_TYPE2}>)
          FILTER NOT EXISTS { ?s <${RDF_TYPE2}> ?t }
        }
        FILTER NOT EXISTS { GRAPH <kg:inferred> { ?s <${RDF_TYPE2}> ?ti } }
        FILTER NOT EXISTS { GRAPH <kg:tbox>     { ?s <${RDF_TYPE2}> ?tb } }
      }
      GROUP BY ?s
    `);
    return r.results.bindings.map((b) => ({
      s: b.s.value,
      predicates: (b.preds?.value ?? "").split("|").filter((p) => p.length > 0)
    }));
  }
  groupByFingerprint(rows) {
    const groups = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = [...new Set(row.predicates)].sort().join("|");
      const arr = groups.get(key) ?? [];
      arr.push(row.s);
      groups.set(key, arr);
    }
    return groups;
  }
};

// ../predicate-mcp/src/tools/kg-maintain.ts
var META5 = "https://predicate.dev/meta#";
async function kgMaintain(client, input = {}) {
  const archiveCutoff = input.archiveCutoff ?? 0.6;
  const ageDays = input.ageDays ?? 30;
  const cutoffDate = new Date(Date.now() - ageDays * 864e5).toISOString();
  const t0 = Date.now();
  await client.update(`CREATE SILENT GRAPH <kg:abox-archive>`);
  const before = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }`
  );
  const beforeCount = parseInt(before.results.bindings[0].n.value, 10);
  await client.update(`
    PREFIX pred: <${META5}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    DELETE { GRAPH <kg:abox> { ?s ?p ?o } }
    INSERT { GRAPH <kg:abox-archive> { ?s ?p ?o } }
    WHERE {
      GRAPH <kg:abox> { ?s ?p ?o }
      GRAPH <kg:provenance> {
        << ?s ?p ?o >> pred:confidence ?conf ;
                       pred:timestamp  ?ts .
        FILTER (?conf < ${archiveCutoff})
        FILTER (?ts < "${cutoffDate}"^^xsd:dateTime)
      }
    }
  `);
  const after = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }`
  );
  const afterCount = parseInt(after.results.bindings[0].n.value, 10);
  const archivedCount = beforeCount - afterCount;
  const generalizer = await new Generalizer(client, {
    k: input.generalizerK ?? 5
  }).run();
  const sweeper = await new PromotionSweeper(client, {
    useThreshold: input.useThreshold ?? 3
  }).run();
  const eventId = `urn:predicate:event:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const elapsedMs = Date.now() - t0;
  await client.update(`
    PREFIX pred: <${META5}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:meta> {
      <${eventId}> a pred:MaintenanceRun ;
        pred:at        "${(/* @__PURE__ */ new Date()).toISOString()}"^^xsd:dateTime ;
        pred:actor     "kg_maintain" ;
        pred:payload   ${escapeLiteral(JSON.stringify({
    archivedCount,
    elapsedMs,
    archiveCutoff,
    ageDays,
    sweeperDecisions: sweeper.decisions.length,
    generalizerProposals: generalizer.proposals.length
  }))} .
    } }
  `);
  return { archivedCount, elapsedMs, eventId, sweeper, generalizer };
}

// ../predicate-cli/src/commands/maintain.ts
async function maintain() {
  try {
    const client = new SparqlClient(loadConfig());
    const result = await kgMaintain(client, {});
    const proposals = result.generalizer?.proposals.length ?? 0;
    const promotions = result.sweeper?.decisions.filter((d) => d.outcome === "promoted").length ?? 0;
    console.log(
      `predicate maintain: archived=${result.archivedCount} proposals=${proposals} promotions=${promotions} elapsed=${result.elapsedMs}ms event=${result.eventId}`
    );
    return 0;
  } catch (err2) {
    console.error(`predicate maintain failed: ${err2.message}`);
    return 1;
  }
}

// ../predicate-mcp/src/tools/kg-capture.ts
var META6 = "https://predicate.dev/meta#";
function truncate(s, max) {
  if (s.length <= max) return s;
  const extra = s.length - max;
  return `${s.slice(0, max)} \u2026 [truncated, ${extra} more chars]`;
}
function serialize(value, max) {
  let s;
  if (value === void 0 || value === null) s = "";
  else if (typeof value === "string") s = value;
  else {
    try {
      s = JSON.stringify(value);
    } catch {
      s = String(value);
    }
  }
  return truncate(s, max);
}
async function kgCapture(client, input) {
  const t0 = Date.now();
  const maxChars = parseInt(process.env["PREDICATE_CAPTURE_TRUNCATE"] ?? "500", 10);
  const captureId = `urn:predicate:capture:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const inputStr = serialize(input.input, maxChars);
  const hasOutput = input.output !== void 0 && input.output !== null;
  const outputStr = hasOutput ? serialize(input.output, maxChars) : "";
  const lines = [
    `${escapeIRI(captureId)} a <${META6}ToolCall> ;`,
    `  <${META6}toolName>  ${escapeLiteral(input.toolName)} ;`,
    `  <${META6}phase>     ${escapeLiteral(input.phase)} ;`,
    `  <${META6}at>        "${(/* @__PURE__ */ new Date()).toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime>`
  ];
  if (inputStr.length > 0) lines.push(`  ; <${META6}toolInput>  ${escapeLiteral(inputStr)}`);
  if (hasOutput) lines.push(`  ; <${META6}toolOutput> ${escapeLiteral(outputStr)}`);
  if (input.sessionId) lines.push(`  ; <${META6}sessionId>  ${escapeLiteral(input.sessionId)}`);
  lines.push("  .");
  await client.update(`
    INSERT DATA { GRAPH ${escapeIRI(GRAPH.usage)} {
      ${lines.join("\n      ")}
    } }
  `);
  return { captureId, elapsedMs: Date.now() - t0 };
}

// ../predicate-cli/src/commands/capture.ts
function parseFlag(args, name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return void 0;
  return args[i + 1];
}
function hasFlag(args, name) {
  return args.includes(name);
}
function help() {
  console.log(`predicate capture [options]

Record a tool invocation into kg:usage. Suitable for use from
platform-specific PreToolUse / PostToolUse hook scripts.

Options:
  --tool NAME           Tool name (required unless --from-stdin)
  --phase pre|post      Hook phase (required)
  --input  JSON_OR_STR  Serialized tool input (optional)
  --output JSON_OR_STR  Serialized tool output (optional)
  --session ID          Session identifier (optional)
  --from-stdin          Parse a Claude-Code-shaped JSON object from stdin
                        (keys: session_id, tool_name, tool_input, tool_response).
                        --phase is still required.
  --help                Print this message.

Env:
  PREDICATE_CAPTURE_SKIP       Comma list of tool names to suppress (default "").
  PREDICATE_CAPTURE_TRUNCATE   Max chars per field (default 500).
  FUSEKI_URL, PREDICATE_DATASET   Server location.
`);
}
async function readStdin(stream) {
  let buf = "";
  for await (const chunk of stream) buf += String(chunk);
  return buf;
}
function shouldSkip(toolName) {
  const raw = process.env["PREDICATE_CAPTURE_SKIP"] ?? "";
  if (raw.length === 0) return false;
  return raw.split(",").map((s) => s.trim()).includes(toolName);
}
function parseMaybeJson(s) {
  if (s === void 0) return void 0;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
async function capture(args, stdin = process.stdin) {
  if (hasFlag(args, "--help")) {
    help();
    return 0;
  }
  const phase = parseFlag(args, "--phase");
  if (phase !== "pre" && phase !== "post") {
    console.error('predicate capture: --phase must be "pre" or "post"');
    return 2;
  }
  let toolName;
  let toolInput;
  let toolOutput;
  let sessionId;
  if (hasFlag(args, "--from-stdin")) {
    const raw = await readStdin(stdin);
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (err2) {
      console.error(`predicate capture: invalid JSON on stdin: ${err2.message}`);
      return 2;
    }
    toolName = typeof payload["tool_name"] === "string" ? payload["tool_name"] : void 0;
    toolInput = payload["tool_input"];
    toolOutput = payload["tool_response"];
    sessionId = typeof payload["session_id"] === "string" ? payload["session_id"] : void 0;
  } else {
    toolName = parseFlag(args, "--tool");
    toolInput = parseMaybeJson(parseFlag(args, "--input"));
    toolOutput = parseMaybeJson(parseFlag(args, "--output"));
    sessionId = parseFlag(args, "--session");
  }
  if (!toolName) {
    console.error("predicate capture: --tool is required (or --from-stdin with payload.tool_name)");
    return 2;
  }
  if (shouldSkip(toolName)) return 0;
  try {
    const client = new SparqlClient(loadConfig());
    await kgCapture(client, { toolName, input: toolInput, output: toolOutput, sessionId, phase });
    return 0;
  } catch (err2) {
    console.error(`predicate capture failed: ${err2.message}`);
    return 1;
  }
}

// ../predicate-cli/src/index.ts
var VERSION = "1.0.0";
function help2() {
  console.log(`predicate <command>

Commands:
  up             Bring Fuseki up (docker compose up -d) and load the seed TBox.
  down           Stop Fuseki, preserve the data volume.
  doctor         Health checks: docker, fuseki, tbox.
  stats          Print kg_stats output for the live graph.
  sessionstart   Print a one-line KG status banner (used by hook scripts).
  maintain       Run kg_maintain (reaper + generalizer + sweeper).
  capture        Record a tool invocation in kg:usage (used by PreTool/PostTool hooks).
  --version      Print the predicate version.
  --help         This message.

Env:
  FUSEKI_URL                http://localhost:3030 (default)
  PREDICATE_DATASET         predicate (default)
  PREDICATE_ADMIN_USER      admin (default)
  PREDICATE_ADMIN_PASSWORD  changeme (default)
  PREDICATE_COMPOSE_DIR     override docker-compose.yml location
  PREDICATE_CAPTURE_SKIP    comma list of tool names to skip in kg_capture
  PREDICATE_CAPTURE_TRUNCATE  max chars per captured input/output (default 500)
`);
}
async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case "up":
      return up();
    case "down":
      return down();
    case "doctor":
      return doctor();
    case "stats":
      return stats();
    case "sessionstart":
      return sessionstart();
    case "maintain":
      return maintain();
    case "capture":
      return capture(process.argv.slice(3));
    case "--version":
    case "version":
      console.log(VERSION);
      return 0;
    case void 0:
    case "--help":
    case "help":
      help2();
      return 0;
    default:
      console.error(`unknown command: ${cmd}`);
      help2();
      return 2;
  }
}
main().then((code) => process.exit(code)).catch((err2) => {
  console.error(err2);
  process.exit(1);
});
/*! Bundled license information:

safe-buffer/index.js:
  (*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> *)
*/
