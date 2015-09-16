var _ = require('lodash');
var Formatter = require('content-formatter');
var sub = require('string-sub');

var REGEX = require('../regex_new');

var getRegExp = REGEX.getRegExp;

var base = require('../base');

var iterateLines = base.iterateLines;
var toInt = base.toInt;

var classNameConvertMap = REGEX.MAP_CLASS_NAMES_CONVERT_HTML;

var token = String.fromCharCode(-1);

Formatter.HTML = Formatter.create(
	{
		id: 'html',
		includes: /\.(jsp.?|html|vm|ftl|tpl|tmpl)$/,
		prototype: {
			format: function(contents) {
				var instance = this;

				var logger = this.log.bind(this);

				contents = iterateLines(
					contents,
					function(item, index, collection) {
						item = instance._escapeTokens(item);

						item = instance.processFile(item, index, collection, logger);

						item = instance._unescapeTokens(item);

						return item;
					}
				);

				instance._processCSS(contents);
				instance._processJS(contents);

				return contents;
			},

			processFile: function(content, index, collection, logger) {
				var re = this._re;

				var rawContent = content;

				var context = this._getContext(rawContent, index, collection);

				context.rawContent = rawContent;

				rawContent = this._convertHtmlAttributeValues(context, index, collection, logger);

				rawContent = re.iterateRules('html', context);

				return rawContent;
			},

			_convertHtmlAttributeValues: function(context, index, collection, logger) {
				var fullItem = context.rawContent;

				var lineNum = index + 1;

				var newLine = fullItem.replace(
					REGEX.REGEX_HTML_ATTRIBUTES,
					function(m, attr, attrName, quote, attrValue) {
						var full = attrName + '=' + quote + attrValue + quote;

						if ((/(?!class(Name|PK))(css)?Class/i).test(attrName)) {
							var attrValuePieces = attrValue.split(' ');

							var attrValuePiecesFiltered = attrValuePieces.map(
								function(item2, index2) {
									var newItem = item2;

									if (classNameConvertMap.hasOwnProperty(newItem)) {
										if (newItem != 'btn' || (newItem == 'btn' && !/\bbtn-.*\b/.test(attrValue))) {
											newItem = classNameConvertMap[newItem];
										}
									}
									else {
										_.forEach(
											REGEX.MAP_REGEX_CLASS_NAMES_CONVERT_HTML,
											function(replace, rule) {
												newItem = newItem.replace(getRegExp(rule), replace);
											}
										);
									}

									if (item2 != newItem) {
										logger(lineNum, sub('"{0}" has changed to "{1}"', item2, newItem));
									}

									return newItem;
								}
							);

							attrValue = attrValuePiecesFiltered.join(' ');
						}

						full = attrName + '=' + quote + attrValue + quote;

						return full;
					}
				);

				return newLine;
			},

			_escapeTokens: function(content) {
				var m = content.match(/<%.*?%>/g);

				this._tokenMatches = m && m.map(
					function(item, index, collection) {
						content = content.replace(item, token + index + token);

						return item;
					}
				);

				return content;
			},

			_getContext: function(content, index, collection) {
				return context = {
					collection: collection,
					content: content,
					file: this.file,
					index: index,
					lineNum: index + 1
				};
			},

			_processCSS: function(contents) {
				var instance = this;

				var hasCss = (/<style>([\s\S]*?)<\/style>/).test(contents);

				if (hasCss) {
					contents.replace(
						/<style[^>]*?>([\s\S]*?)<\/style>/g,
						function(m, body, index) {
							body = body.replace(/<%=[^>]+>/g, '_')
										.replace(/<portlet:namespace \/>/g, '_')
										.replace(/\$\{.*?\}/g, '_')
										.replace(/<%[^>]+>/g, '/* scriptlet block */')
										.replace(/<\/?[A-Za-z0-9-_]+:[^>]+>/g, '/* jsp tag */');

							instance._runSecondaryFormatter('css', body);
						}
					);
				}
			},

			_processJS: function(contents) {
				var instance = this;

				var hasJs = (/<(aui:)?script>([\s\S]*?)<\/\1script>/).test(contents);

				if (hasJs) {
					contents.replace(
						/<(aui:)?script[^>]*?>([\s\S]*?)<\/\1script>/g,
						function(m, tagNamespace, body, index) {
							body = body.replace(/<%=[^>]+>/g, '_')
										.replace(/<portlet:namespace \/>/g, '_')
										.replace(/\$\{.*?\}/g, '_')
										.replace(/<%[^>]+>/g, '/* scriptlet block */')
										.replace(/<\/?[A-Za-z0-9-_]+:[^>]+>/g, '/* jsp tag */');

							instance._runSecondaryFormatter('js', body);
						}
					);
				}
			},

			_runSecondaryFormatter: function(name, contents) {
				require('./' + name);

				var formatter = new Formatter[name.toUpperCase()](this.file, this.logger, this.flags);

				formatter.format(contents);
			},

			_unescapeTokens: function(content) {
				var tokenMatches = this._tokenMatches;

				if (tokenMatches) {
					content = content.replace(
						new RegExp(token + '(\\d+)' + token, 'g'),
						function(str, id) {
							return tokenMatches[id];
						}
					);
				}

				return content;
			}
		}
	}
);

module.exports = Formatter.HTML;