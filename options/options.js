'use strict';

document.addEventListener( 'DOMContentLoaded', () =>
{
	const tagsContainer = document.getElementById( 'keywords-tags' );
	const newKeywordInput = document.getElementById( 'new-keyword-input' );
	const btnAddKeyword = document.getElementById( 'btn-add-keyword' );
	const sliderDelay = document.getElementById( 'slider-delay' );
	const labelDelayVal = document.getElementById( 'label-delay-val' );
	const checkConfirm = document.getElementById( 'check-confirm' );
	const checkBackup = document.getElementById( 'check-backup' );
	const toastMsg = document.getElementById( 'toast-msg' );
	const btnResetDefaults = document.getElementById( 'btn-reset-defaults' );
	const historyTbody = document.getElementById( 'history-tbody' );
	const historyCount = document.getElementById( 'history-count' );
	const btnClearHistory = document.getElementById( 'btn-clear-history' );
	const btnExportHistory = document.getElementById( 'btn-export-history' );

	let currentKeywords = [];
	let currentHistory = [];

	// Load stored options
	GetOption( DEFAULT_OPTIONS, ( options ) =>
	{
		currentKeywords = Array.isArray( options.keywords ) ? [ ...options.keywords ] : [ ...DEFAULT_OPTIONS.keywords ];
		RenderKeywords();

		sliderDelay.value = options.requestDelay || 1000;
		labelDelayVal.textContent = `${sliderDelay.value} ms`;

		checkConfirm.checked = ( options.confirmBeforeDelete !== false );
		checkBackup.checked = ( options.autoBackup !== false );

		LoadHistory();
	} );

	function RenderKeywords()
	{
		tagsContainer.innerHTML = '';
		currentKeywords.forEach( ( kw ) =>
		{
			const tag = document.createElement( 'div' );
			tag.className = 'keyword-tag';
			tag.innerHTML = `
				<span>${EscapeHtml( kw )}</span>
				<span class="keyword-remove" title="Remove keyword">×</span>
			`;

			tag.querySelector( '.keyword-remove' ).addEventListener( 'click', () =>
			{
				currentKeywords = currentKeywords.filter( k => k !== kw );
				SaveKeywords();
				RenderKeywords();
			} );

			tagsContainer.appendChild( tag );
		} );
	}

	function SaveKeywords()
	{
		SetOption( 'keywords', currentKeywords, () => ShowToast() );
	}

	function AddKeyword()
	{
		const val = newKeywordInput.value.trim().toLowerCase();
		if( !val ) return;

		if( !currentKeywords.includes( val ) )
		{
			currentKeywords.push( val );
			SaveKeywords();
			RenderKeywords();
		}
		newKeywordInput.value = '';
	}

	btnAddKeyword.addEventListener( 'click', AddKeyword );
	newKeywordInput.addEventListener( 'keydown', ( e ) =>
	{
		if( e.key === 'Enter' )
		{
			e.preventDefault();
			AddKeyword();
		}
	} );

	sliderDelay.addEventListener( 'input', ( e ) =>
	{
		labelDelayVal.textContent = `${e.target.value} ms`;
	} );

	sliderDelay.addEventListener( 'change', ( e ) =>
	{
		SetOption( 'requestDelay', Number.parseInt( e.target.value, 10 ), () => ShowToast() );
	} );

	checkConfirm.addEventListener( 'change', ( e ) =>
	{
		SetOption( 'confirmBeforeDelete', e.target.checked, () => ShowToast() );
	} );

	checkBackup.addEventListener( 'change', ( e ) =>
	{
		SetOption( 'autoBackup', e.target.checked, () => ShowToast() );
	} );

	btnResetDefaults.addEventListener( 'click', () =>
	{
		if( !confirm( 'Reset all settings and detection keywords to default?' ) ) return;

		currentKeywords = [ ...DEFAULT_OPTIONS.keywords ];
		sliderDelay.value = DEFAULT_OPTIONS.requestDelay;
		labelDelayVal.textContent = `${DEFAULT_OPTIONS.requestDelay} ms`;
		checkConfirm.checked = DEFAULT_OPTIONS.confirmBeforeDelete;
		checkBackup.checked = DEFAULT_OPTIONS.autoBackup;

		SetOption( 'keywords', currentKeywords );
		SetOption( 'requestDelay', DEFAULT_OPTIONS.requestDelay );
		SetOption( 'confirmBeforeDelete', DEFAULT_OPTIONS.confirmBeforeDelete );
		SetOption( 'autoBackup', DEFAULT_OPTIONS.autoBackup, () =>
		{
			RenderKeywords();
			ShowToast( 'Reset to defaults!' );
		} );
	} );

	function LoadHistory()
	{
		ExtensionApi.storage.local.get( { removalHistory: [] }, ( data ) =>
		{
			currentHistory = data.removalHistory || [];
			historyCount.textContent = `${currentHistory.length} items recorded`;

			if( currentHistory.length === 0 )
			{
				historyTbody.innerHTML = `<tr><td colspan="3" class="history-empty">No removed licenses recorded yet.</td></tr>`;
				return;
			}

			historyTbody.innerHTML = '';
			currentHistory.slice( 0, 100 ).forEach( ( item ) =>
			{
				const tr = document.createElement( 'tr' );
				const dateStr = item.timestamp ? new Date( item.timestamp ).toLocaleDateString() : '-';
				tr.innerHTML = `
					<td style="color: #8b949e;">${dateStr}</td>
					<td><code>#${item.packageid}</code></td>
					<td>${EscapeHtml( item.title )}</td>
				`;
				historyTbody.appendChild( tr );
			} );
		} );
	}

	btnClearHistory.addEventListener( 'click', () =>
	{
		if( !confirm( 'Clear all removal history records?' ) ) return;
		ExtensionApi.storage.local.set( { removalHistory: [] }, () =>
		{
			LoadHistory();
			ShowToast( 'History cleared.' );
		} );
	} );

	btnExportHistory.addEventListener( 'click', () =>
	{
		if( currentHistory.length === 0 )
		{
			alert( 'No history to export.' );
			return;
		}

		const blob = new Blob( [ JSON.stringify( currentHistory, null, 2 ) ], { type: 'application/json' } );
		const url = URL.createObjectURL( blob );
		const a = document.createElement( 'a' );
		a.href = url;
		a.download = `steam_removed_history_${new Date().toISOString().split( 'T' )[ 0 ]}.json`;
		document.body.appendChild( a );
		a.click();
		a.remove();
		URL.revokeObjectURL( url );
	} );

	let toastTimeout = null;
	function ShowToast( msg = 'Preferences saved automatically.' )
	{
		toastMsg.textContent = msg;
		toastMsg.classList.add( 'show' );
		clearTimeout( toastTimeout );
		toastTimeout = setTimeout( () =>
		{
			toastMsg.classList.remove( 'show' );
		}, 2500 );
	}

	function EscapeHtml( str )
	{
		const div = document.createElement( 'div' );
		div.textContent = str;
		return div.innerHTML;
	}
} );
