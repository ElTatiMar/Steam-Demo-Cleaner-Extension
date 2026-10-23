'use strict';

/**
 * Steam Demo Cleaner - Background Service Worker
 * Based on the SteamDB Extension architecture blueprint
 */

let storeSessionId = null;

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

	throw new Error( 'Did not find appropriate web extensions api' );
} )();

ExtensionApi.runtime.onInstalled.addListener( ( details ) =>
{
	if( details.reason === 'install' )
	{
		console.log( '[Steam Demo Cleaner] Extension installed successfully.' );
	}
} );

ExtensionApi.runtime.onMessage.addListener( ( request, sender, callback ) =>
{
	if( !request || !request.contentScriptQuery )
	{
		return false;
	}

	switch( request.contentScriptQuery )
	{
		case 'GetSessionID':
			GetStoreSessionID( ( session ) => callback( session ) );
			return true;

		case 'RemoveLicense':
			StoreRemoveFreeLicense( request, callback );
			return true;

		case 'FetchLicensesPage':
			FetchLicensesPage( request, callback );
			return true;

		case 'SaveRemovalLog':
			SaveRemovalLog( request.items, callback );
			return true;
	}

	callback( { success: false, error: 'Unknown contentScriptQuery' } );
	return false;
} );

/**
 * Extract or retrieve the current Steam session ID
 * @param {(obj: {success: boolean, sessionID?: string, error?: string}) => void} callback
 */
function GetStoreSessionID( callback )
{
	if( storeSessionId !== null )
	{
		callback( { success: true, sessionID: storeSessionId } );
		return;
	}

	fetch( 'https://store.steampowered.com/account/licenses/', {
		credentials: 'include',
		headers: {
			Accept: 'text/html',
		},
	} )
		.then( async( response ) =>
		{
			if( response.redirected && response.url.includes( '/login' ) )
			{
				throw new Error( 'No active Steam session. Please log in on the Steam store.' );
			}

			const text = await response.text();
			const match = /g_sessionID = "(?<sessionid>[^"]+)";/.exec( text );

			if( match && match.groups && match.groups.sessionid )
			{
				storeSessionId = match.groups.sessionid;
				callback( { success: true, sessionID: storeSessionId } );
			}
			else
			{
				throw new Error( 'Could not find Steam session ID. Are you logged in?' );
			}
		} )
		.catch( ( error ) =>
		{
			callback( { success: false, error: error.message } );
		} );
}

/**
 * Remove a free license/package from the user's Steam account
 * @param {{packageid: number|string, title?: string}} request
 * @param {(response: {success: boolean, error?: string, rateLimited?: boolean, requiresLogin?: boolean}) => void} callback
 */
function StoreRemoveFreeLicense( request, callback )
{
	const packageid = request.packageid ? request.packageid.toString() : null;

	if( !packageid )
	{
		callback( { success: false, error: 'No packageid specified' } );
		return;
	}

	GetStoreSessionID( ( session ) =>
	{
		if( !session.success || !session.sessionID )
		{
			callback( { success: false, error: session.error || 'Failed to acquire session ID', requiresLogin: true } );
			return;
		}

		const formData = new URLSearchParams();
		formData.set( 'sessionid', session.sessionID );
		formData.set( 'packageid', packageid );

		fetch( 'https://store.steampowered.com/account/removelicense', {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				'X-Requested-With': 'SteamDemoCleaner',
				'Accept': '*/*'
			},
			body: formData.toString()
		} )
			.then( async( response ) =>
			{
				if( response.redirected && response.url.includes( '/login' ) )
				{
					storeSessionId = null;
					return { success: false, error: 'Steam session expired.', requiresLogin: true };
				}

				if( response.status === 401 || response.status === 403 )
				{
					storeSessionId = null;
					return { success: false, error: 'Session unauthorized (HTTP ' + response.status + ').', requiresLogin: true };
				}

				const text = await response.text();
				let data;

				try
				{
					data = JSON.parse( text );
				}
				catch
				{
					if( text.includes( 'login' ) || text.trim().startsWith( '<' ) )
					{
						storeSessionId = null;
						return { success: false, error: 'Steam returned login redirect.', requiresLogin: true };
					}
					return { success: false, error: 'Invalid response from Steam store API.' };
				}

				if( data.requires_login )
				{
					storeSessionId = null;
					return { success: false, error: 'Login required by Steam API.', requiresLogin: true };
				}

				// Steam rate-limiting response code is 84
				if( data.success === 84 || response.status === 429 )
				{
					return {
						success: false,
						rateLimited: true,
						error: 'Steam rate limited this action. Please wait before retrying.'
					};
				}

				if( data.success === 1 || data.success === true )
				{
					return { success: true };
				}

				return {
					success: false,
					error: `Steam returned code ${data.success || 'unknown'}`
				};
			} )
			.then( ( result ) =>
			{
				callback( result );
			} )
			.catch( ( err ) =>
			{
				callback( { success: false, error: err.message || 'Network error' } );
			} );
	} );
}

/**
 * Fetch a specific pagination page of account licenses
 * @param {{url?: string}} request
 * @param {(response: {success: boolean, html?: string, error?: string}) => void} callback
 */
function FetchLicensesPage( request, callback )
{
	const targetUrl = request.url || 'https://store.steampowered.com/account/licenses/';

	fetch( targetUrl, {
		credentials: 'include',
		headers: {
			Accept: 'text/html'
		}
	} )
		.then( async( response ) =>
		{
			if( response.redirected && response.url.includes( '/login' ) )
			{
				throw new Error( 'Session expired / redirected to login' );
			}
			if( !response.ok )
			{
				throw new Error( `HTTP ${response.status}: ${response.statusText}` );
			}

			const html = await response.text();
			callback( { success: true, html } );
		} )
		.catch( ( err ) =>
		{
			callback( { success: false, error: err.message } );
		} );
}

/**
 * Persist removal audit log into local storage
 * @param {Array<{packageid: number, title: string, timestamp: number}>} items
 * @param {() => void} [callback]
 */
function SaveRemovalLog( items, callback )
{
	if( !Array.isArray( items ) || items.length === 0 )
	{
		if( callback ) callback();
		return;
	}

	ExtensionApi.storage.local.get( { removalHistory: [] }, ( data ) =>
	{
		const history = data.removalHistory || [];
		const updated = [ ...items, ...history ].slice( 0, 500 ); // keep last 500

		ExtensionApi.storage.local.set( { removalHistory: updated }, () =>
		{
			if( callback ) callback();
		} );
	} );
}
