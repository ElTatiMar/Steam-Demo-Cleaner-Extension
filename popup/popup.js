'use strict';

document.addEventListener( 'DOMContentLoaded', () =>
{
	const statusDot = document.getElementById( 'status-dot' );
	const statusText = document.getElementById( 'status-text' );
	const statusDesc = document.getElementById( 'status-desc' );
	const btnOpenLicenses = document.getElementById( 'btn-open-licenses' );
	const linkOptions = document.getElementById( 'link-options' );

	// Check active tab
	ExtensionApi.tabs.query( { active: true, currentWindow: true }, ( tabs ) =>
	{
		const currentTab = tabs && tabs[ 0 ];
		const isLicensesPage = currentTab && currentTab.url && currentTab.url.includes( 'store.steampowered.com/account/licenses' );

		if( isLicensesPage )
		{
			statusDot.classList.add( 'active' );
			statusText.textContent = 'Active on Steam Licenses';
			statusDesc.textContent = 'The Demo Cleaner dashboard is injected directly into your active page.';
			btnOpenLicenses.textContent = '🎯 Focus Cleaner Toolbar';
			btnOpenLicenses.onclick = () =>
			{
				ExtensionApi.tabs.sendMessage( currentTab.id, { action: 'focus_dashboard' } ).catch( () => {} );
				window.close();
			};
		}
		else
		{
			statusDot.classList.remove( 'active' );
			statusText.textContent = 'Not on Licenses Page';
			statusDesc.textContent = 'Click below to navigate to your Steam Account Licenses page.';
			btnOpenLicenses.textContent = '🚀 Open Steam Licenses Page';
			btnOpenLicenses.onclick = () =>
			{
				ExtensionApi.tabs.create( { url: 'https://store.steampowered.com/account/licenses/' } );
				window.close();
			};
		}
	} );

	linkOptions.addEventListener( 'click', ( e ) =>
	{
		e.preventDefault();
		if( ExtensionApi.runtime.openOptionsPage )
		{
			ExtensionApi.runtime.openOptionsPage();
		}
		else
		{
			ExtensionApi.tabs.create( { url: ExtensionApi.runtime.getURL( 'options/options.html' ) } );
		}
		window.close();
	} );
} );
