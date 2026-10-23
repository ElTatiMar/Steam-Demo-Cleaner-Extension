'use strict';

/**
 * Steam Demo Cleaner - Main World Injected Script
 * Runs directly in the context of store.steampowered.com
 */
( () =>
{
	const hasSession = Boolean( window.g_sessionID ) &&
		( ( window.g_steamID && window.g_steamID !== '0' && window.g_steamID !== false ) ||
			( typeof window.g_AccountID !== 'undefined' && window.g_AccountID !== 0 ) );

	window.postMessage( {
		type: 'sdc:session_info',
		hasSession,
		sessionID: window.g_sessionID || null,
		steamID: window.g_steamID || null
	}, window.location.origin );

	// Listen for requests to invalidate dynamic store cache if GDynamicStore exists
	window.addEventListener( 'message', ( event ) =>
	{
		if( !event || event.origin !== window.location.origin ) return;

		if( event.data && event.data.type === 'sdc:invalidate_cache' )
		{
			if( window.GDynamicStore && typeof window.GDynamicStore.InvalidateCache === 'function' )
			{
				window.GDynamicStore.InvalidateCache();
			}
		}
	} );
} )();
