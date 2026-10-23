'use strict';

/**
 * Cross-browser Extension API abstraction
 * Compatible with Chrome, Edge, Brave, and Firefox
 */
const ExtensionApi = ( () =>
{
	if( typeof browser !== 'undefined' && typeof browser.storage !== 'undefined' )
	{
		return browser;
	}
	else if( typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined' )
	{
		return chrome;
	}

	throw new Error( 'No compatible WebExtensions API runtime found.' );
} )();

const DEFAULT_OPTIONS = {
	keywords: [
		'demo',
		'playtest',
		'prologue',
		'teaser',
		'trailer',
		'beta',
		'trial',
		'sneak peek',
		'pegi',
		'esrb'
	],
	requestDelay: 1000,
	scanAllPages: true,
	confirmBeforeDelete: true,
	autoBackup: true,
	removalHistory: []
};

/**
 * Retrieve options from sync/local storage with fallback defaults
 * @param {Record<string, any>} keys
 * @param {(items: Record<string, any>) => void} callback
 */
function GetOption( keys, callback )
{
	const query = {};
	for( const key of Object.keys( keys ) )
	{
		query[ key ] = keys[ key ] !== undefined ? keys[ key ] : DEFAULT_OPTIONS[ key ];
	}

	ExtensionApi.storage.sync.get( query )
		.then( ( items ) =>
		{
			// Fill any missing defaults
			const resolved = { ...query, ...items };
			callback( resolved );
		} )
		.catch( () =>
		{
			// Fallback to local storage if sync is unavailable
			ExtensionApi.storage.local.get( query )
				.then( ( items ) => callback( { ...query, ...items } ) )
				.catch( () => callback( query ) );
		} );
}

/**
 * Set an option in storage
 * @param {string} option
 * @param {any} value
 * @param {() => void} [callback]
 */
function SetOption( option, value, callback )
{
	const payload = { [ option ]: value };

	ExtensionApi.storage.sync.set( payload )
		.then( () =>
		{
			if( callback ) callback();
		} )
		.catch( () =>
		{
			ExtensionApi.storage.local.set( payload )
				.then( () =>
				{
					if( callback ) callback();
				} );
		} );
}

/**
 * Send message to the background service worker
 * @param {Record<string, any>} message
 * @param {(response: any) => void} [callback]
 */
function SendMessageToBackgroundScript( message, callback )
{
	try
	{
		ExtensionApi.runtime.sendMessage( message, ( response ) =>
		{
			const lastError = ExtensionApi.runtime.lastError;
			if( lastError )
			{
				WriteLog( 'Runtime messaging error:', lastError.message );
				if( callback ) callback( { success: false, error: lastError.message } );
				return;
			}

			if( callback ) callback( response );
		} );
	}
	catch( err )
	{
		WriteLog( 'SendMessage exception:', err );
		if( callback ) callback( { success: false, error: err.message } );
	}
}

/**
 * Extract Package ID from RemoveFreeLicense call or string
 * @param {string} htmlOrText
 * @returns {number|null}
 */
function ExtractPackageId( htmlOrText )
{
	if( !htmlOrText ) return null;

	const match = /RemoveFreeLicense\s*\(\s*(?<subid>\d+)/.exec( htmlOrText );
	if( match && match.groups && match.groups.subid )
	{
		return Number.parseInt( match.groups.subid, 10 );
	}

	return null;
}

/**
 * Classify a game/package title into categories
 * @param {string} title
 * @param {string[]} keywords
 * @returns {{ isMatch: boolean, category: 'demo'|'playtest'|'prologue'|'beta'|'other', matchedKeyword: string|null }}
 */
function ClassifyLicense( title, keywords = DEFAULT_OPTIONS.keywords )
{
	const clean = ( title || '' ).toLowerCase();

	if( /\b(?:demo)\b/i.test( clean ) )
	{
		return { isMatch: true, category: 'demo', matchedKeyword: 'demo' };
	}
	if( /\b(?:playtest)\b/i.test( clean ) )
	{
		return { isMatch: true, category: 'playtest', matchedKeyword: 'playtest' };
	}
	if( /\b(?:prologue)\b/i.test( clean ) )
	{
		return { isMatch: true, category: 'prologue', matchedKeyword: 'prologue' };
	}
	if( /\b(?:beta|alpha|trial|sneak peek|teaser|trailer)\b/i.test( clean ) )
	{
		const match = clean.match( /\b(beta|alpha|trial|sneak peek|teaser|trailer)\b/i );
		return { isMatch: true, category: 'beta', matchedKeyword: match ? match[ 1 ] : 'beta' };
	}

	for( const kw of keywords )
	{
		const escaped = kw.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
		const regex = new RegExp( `\\b${escaped}\\b`, 'i' );
		if( regex.test( clean ) )
		{
			return { isMatch: true, category: 'other', matchedKeyword: kw };
		}
	}

	return { isMatch: false, category: 'other', matchedKeyword: null };
}

/**
 * Formatted extension logger
 * @param {string} message
 * @param {...any} args
 */
function WriteLog( message, ...args )
{
	console.log( `[Steam Demo Cleaner] ${message}`, ...args );
}
