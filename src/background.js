var settings = {
		parse: {
			omnibox: {
				// Set to preference (even "" for all words to be inferred
				// as tags)
				delimiter: "#",
				separator: " "
			},
			bookmarks: {
				// Should be at least one character (to prevent a crazy number
				// from being inferred
				delimiter: "#",
				separator: " "
			}
		},
		caseSensitive: false,
		folders: {
			areTags: true,
			replaceSpace: ""
		},
		newTab: true
	},
	div = document.createElement("div"),
	htmlEncode = function( text ) {
		div.innerHTML = text;
		return div.innerHTML;
	},
	getTags = function( text, context ) {
		var words = [],
			tags = [],
			parseSettings = settings.parse[ context ],
			delimiterLength = parseSettings.delimiter.length,
			args, idx, len, arg, args;
		
		if ( ! settings.caseSensitive ) {
			text = text.toLowerCase();
		}
		
		args = text.split( parseSettings.separator );
		
		for ( idx = 0, len = args.length; idx < len; ++idx ) {
			arg = args[ idx ];
			if ( arg.indexOf( parseSettings.delimiter ) === 0 && arg.length > delimiterLength ) {
				tags.push( arg.slice( delimiterLength ) );
			} else {
				words.push( arg );
			}
		}
		return {
			words: words,
			tags: tags
		};
	},
	getBookmarkIdsFromTags = function( tags ) {
		
		var idx, len, tag, group,
			groups = [];
		
		for ( idx = 0, len = tags.length; idx < len; ++idx ) {
			group = bookmarks.byTag[ tags[ idx ] ];
			if ( group && group.length ) {
				groups.push( group );
			} else {
				groups = [];
				continue;
			}
		}
		return _.intersection.apply( _, groups );
	},
	inputChangedHandler = function( text, suggest ) {
		
		var parsed = getTags( text, "omnibox" ),
			tags = parsed.tags,
			words = parsed.words,
			bookmarkIds = getBookmarkIdsFromTags( tags );
	
		if ( ! bookmarkIds.length ) {
			return;
		}
		chrome.bookmarks.get( bookmarkIds, function( bookmarks ) {
			var suggestions = _.map( bookmarks, function( bookmark ) {
				return {
					content: bookmark.url,
					description: htmlEncode( bookmark.title )
				};
			});
			
			suggestions = _.filter( suggestions, function( suggestion ) {
				var idx, len;
				
				for ( idx = 0, len = words.length; idx < len; ++idx ) {
					if ( suggestion.content.indexOf( words[ idx ] ) === -1 &&
						suggestion.description.indexOf( words[ idx ] ) === -1 ) {
						return false;
					}
				}
				return true;
			});
			suggest( suggestions );
		});
	},
	inputEnteredHandler = function( text ) {
		
		console.log( "Entered: '" + text + "'" );
		var tabProperties = {
			url: text
		};

		if ( settings.newTab ) {
			chrome.tabs.create( tabProperties );
		} else {
			chrome.tabs.update( undefined, tabProperties );
		}
	};

chrome.omnibox.onInputChanged.addListener( inputChangedHandler );
chrome.omnibox.onInputEntered.addListener( inputEnteredHandler );

var iterate = function( children, parents, bookmarks, callback ) {
	var idx, len, child, folderCount, tags, tag,
		folders = [];

	for ( idx = 0, len = children.length; idx < len; ++idx ) {
		child = children[ idx ];
		
		if ( "dateGroupModified" in child ) {
			folders.push( child );
		} else {
			tags = getTags( child.title, "bookmarks" ).tags;
			if ( settings.folders.areTags ) {
				tags = tags.concat( parents );
			}
			var jdx, jen;
			for ( jdx = 0, jen = tags.length; jdx < jen; ++jdx ) {
				tag = tags[ jdx ];
				if ( ! settings.caseSensitive ) {
					tag = tag.toLowerCase();
				}
				if ( tag in bookmarks.byTag ) {
					bookmarks.byTag[ tag ].push( child.id.toString() );
				} else {
					bookmarks.byTag[ tag ] = [ child.id.toString() ];
				}
			}
		}
	}
	
	for( idx = 0, len = folderCount = folders.length; idx < len; ++idx ) {
		(function( folder ) {
			chrome.bookmarks.getChildren( folder.id, function( children ) {
				iterate( children, parents.concat( folder.title.replace(/\s/g, settings.folders.replaceSpace ) ), bookmarks, function() {
					folderCount--;
					if ( folderCount === 0 ) {
						callback();
					}
				} );
			});
		})( folders[ idx ] );
	}
	if ( folderCount === 0 ) {
		callback();
	}
};

var bookmarks,
	reload = function() {
		delete localStorage.bookmarks;
		crawl();
	},
	load = function() {
		localStorage.bookmarks = JSON.stringify( bookmarks );
	},
	crawl = function() {
		if ( ! localStorage.bookmarks ) {
			bookmarks = {
				byTag: {}
			};
			chrome.bookmarks.getChildren( "0", function( children ) {
				iterate( children, [], bookmarks, load );
			} );
		} else {
			bookmarks = JSON.parse( localStorage.bookmarks );
		}
	};

crawl();