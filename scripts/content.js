'use strict';

/**
 * Steam Demo Cleaner - Content Script
 * Runs on https://store.steampowered.com/account/licenses*
 */

( () =>
{
	// Ensure script only runs on the account licenses page
	if( !location.pathname.startsWith( '/account/licenses' ) )
	{
		return;
	}

	/** @type {Array<{packageid: number, title: string, category: string, rowEl?: HTMLTableRowElement, elementRemove?: HTMLAnchorElement}>} */
	let discoveredLicenses = [];
	let activeFilter = 'all';
	let searchQuery = '';
	let isScanInProgress = false;
	let isRemovalInProgress = false;
	let isPaused = false;
	let abortRemoval = false;

	// Inject the main world script to verify session
	const injectedScript = document.createElement( 'script' );
	injectedScript.src = ExtensionApi.runtime.getURL( 'scripts/injected.js' );
	injectedScript.onload = () => injectedScript.remove();
	( document.head || document.documentElement ).appendChild( injectedScript );

	// Listen for session info message from injected script
	window.addEventListener( 'message', ( event ) =>
	{
		if( !event || event.origin !== window.location.origin ) return;
		if( event.data && event.data.type === 'sdc:session_info' )
		{
			WriteLog( 'Session verified:', event.data.hasSession ? 'Active' : 'Missing' );
		}
	} );

	// Initialize dashboard once DOM is ready
	if( document.readyState === 'loading' )
	{
		document.addEventListener( 'DOMContentLoaded', InitCleaner );
	}
	else
	{
		InitCleaner();
	}

	function InitCleaner()
	{
		const table = document.querySelector( '.account_table' );
		if( !table )
		{
			WriteLog( 'Could not find .account_table on page' );
			return;
		}

		GetOption( DEFAULT_OPTIONS, ( options ) =>
		{
			BuildDashboard( table, options );
			ScanCurrentPageTable( table, options );
		} );
	}

	/**
	 * Build and insert the top dashboard above the licenses table
	 * @param {HTMLTableElement} table
	 * @param {typeof DEFAULT_OPTIONS} options
	 */
	function BuildDashboard( table, options )
	{
		const dashboard = document.createElement( 'div' );
		dashboard.id = 'sdc-dashboard';

		dashboard.innerHTML = `
			<div class="sdc-header">
				<div class="sdc-header-left">
					<img src="${ExtensionApi.runtime.getURL( 'icons/icon32.png' )}" class="sdc-logo-icon" alt="Logo">
					<div class="sdc-title">
						Steam Demo Cleaner
						<span class="sdc-version-badge">v1.0</span>
					</div>
				</div>
				<div class="sdc-stats-strip">
					<div class="sdc-stat-item">
						<span class="sdc-stat-label">Removable</span>
						<span class="sdc-stat-value" id="sdc-stat-total">0</span>
					</div>
					<div class="sdc-stat-item">
						<span class="sdc-stat-label">Demos</span>
						<span class="sdc-stat-value" id="sdc-stat-demos">0</span>
					</div>
					<div class="sdc-stat-item">
						<span class="sdc-stat-label">Playtests</span>
						<span class="sdc-stat-value" id="sdc-stat-playtests">0</span>
					</div>
					<div class="sdc-stat-item">
						<span class="sdc-stat-label">Selected</span>
						<span class="sdc-stat-value" id="sdc-stat-selected" style="color: #38bdf8;">0</span>
					</div>
				</div>
			</div>

			<div class="sdc-toolbar">
				<div class="sdc-filters-row">
					<div class="sdc-pills-group" id="sdc-pills-group">
						<div class="sdc-pill active" data-filter="all">All Removable <span class="sdc-pill-count" id="sdc-pill-all">0</span></div>
						<div class="sdc-pill" data-filter="demo">Demos <span class="sdc-pill-count" id="sdc-pill-demos">0</span></div>
						<div class="sdc-pill" data-filter="playtest">Playtests <span class="sdc-pill-count" id="sdc-pill-playtests">0</span></div>
						<div class="sdc-pill" data-filter="prologue">Prologues <span class="sdc-pill-count" id="sdc-pill-prologues">0</span></div>
						<div class="sdc-pill" data-filter="beta">Betas & Trials <span class="sdc-pill-count" id="sdc-pill-betas">0</span></div>
						<div class="sdc-pill" data-filter="other">Other Free <span class="sdc-pill-count" id="sdc-pill-other">0</span></div>
						<div class="sdc-pill" data-filter="selected">Selected <span class="sdc-pill-count" id="sdc-pill-selected">0</span></div>
					</div>

					<div class="sdc-search-wrap">
						<svg class="sdc-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
							<circle cx="11" cy="11" r="8"></circle>
							<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
						</svg>
						<input type="search" class="sdc-search-input" id="sdc-search-box" placeholder="Filter by title or #id...">
					</div>
				</div>

				<div class="sdc-actions-row">
					<div class="sdc-actions-left">
						<button type="button" class="sdc-btn sdc-btn-secondary" id="sdc-btn-select-filtered">
							✓ Select Filtered
						</button>
						<button type="button" class="sdc-btn sdc-btn-secondary" id="sdc-btn-deselect-all">
							✕ Deselect All
						</button>
						<button type="button" class="sdc-btn sdc-btn-secondary" id="sdc-btn-scan-all-pages">
							🔍 Scan All Pages
						</button>
					</div>

					<div class="sdc-actions-right">
						<button type="button" class="sdc-btn sdc-btn-secondary" id="sdc-btn-export">
							📥 Export Backup
						</button>
						<button type="button" class="sdc-btn sdc-btn-primary" id="sdc-btn-clean-demos">
							⚡ 1-Click Clean Demos & Playtests
						</button>
						<button type="button" class="sdc-btn sdc-btn-danger" id="sdc-btn-clean-selected" disabled>
							🗑️ Remove Selected (<span id="sdc-btn-count">0</span>)
						</button>
					</div>
				</div>
			</div>
		`;

		table.parentNode.insertBefore( dashboard, table );

		AttachDashboardEvents( table, options );
	}

	/**
	 * Attach DOM event listeners to controls
	 * @param {HTMLTableElement} table
	 * @param {typeof DEFAULT_OPTIONS} options
	 */
	function AttachDashboardEvents( table, options )
	{
		// Filter pill switching
		const pillsGroup = document.getElementById( 'sdc-pills-group' );
		pillsGroup.addEventListener( 'click', ( e ) =>
		{
			const pill = e.target.closest( '.sdc-pill' );
			if( !pill ) return;

			pillsGroup.querySelectorAll( '.sdc-pill' ).forEach( p => p.classList.remove( 'active' ) );
			pill.classList.add( 'active' );
			activeFilter = pill.dataset.filter;
			ApplyFiltersAndSearch( table );
		} );

		// Live search box
		const searchBox = document.getElementById( 'sdc-search-box' );
		searchBox.addEventListener( 'input', ( e ) =>
		{
			searchQuery = e.target.value.trim().toLowerCase();
			ApplyFiltersAndSearch( table );
		} );

		// Select all filtered
		document.getElementById( 'sdc-btn-select-filtered' ).addEventListener( 'click', () =>
		{
			table.querySelectorAll( 'tbody tr' ).forEach( ( tr ) =>
			{
				if( tr.style.display !== 'none' )
				{
					const cb = tr.querySelector( '.sdc-checkbox' );
					if( cb && !cb.disabled )
					{
						cb.checked = true;
						tr.classList.add( 'sdc-row-marked' );
					}
				}
			} );
			UpdateSelectedCount();
		} );

		// Deselect all
		document.getElementById( 'sdc-btn-deselect-all' ).addEventListener( 'click', () =>
		{
			table.querySelectorAll( '.sdc-checkbox' ).forEach( ( cb ) =>
			{
				cb.checked = false;
				const row = cb.closest( 'tr' );
				if( row ) row.classList.remove( 'sdc-row-marked' );
			} );
			UpdateSelectedCount();
		} );

		// 1-Click Clean Demos & Playtests
		document.getElementById( 'sdc-btn-clean-demos' ).addEventListener( 'click', () =>
		{
			let targets = discoveredLicenses.filter( item => item.category === 'demo' || item.category === 'playtest' );
			if( targets.length === 0 )
			{
				alert( 'No demos or playtests were found to remove on this scan.' );
				return;
			}

			// Automatically check their boxes
			targets.forEach( item =>
			{
				if( item.rowEl )
				{
					const cb = item.rowEl.querySelector( '.sdc-checkbox' );
					if( cb )
					{
						cb.checked = true;
						item.rowEl.classList.add( 'sdc-row-marked' );
					}
				}
			} );
			UpdateSelectedCount();

			PromptAndStartRemoval( targets, options );
		} );

		// Remove Selected
		document.getElementById( 'sdc-btn-clean-selected' ).addEventListener( 'click', () =>
		{
			const selectedItems = GetSelectedLicenses();
			if( selectedItems.length === 0 ) return;

			PromptAndStartRemoval( selectedItems, options );
		} );

		// Export Backup
		document.getElementById( 'sdc-btn-export' ).addEventListener( 'click', () =>
		{
			ExportBackupData();
		} );

		// Scan all pages
		document.getElementById( 'sdc-btn-scan-all-pages' ).addEventListener( 'click', () =>
		{
			ScanAllPages( table, options );
		} );
	}

	/**
	 * Parse the current page's .account_table rows
	 * @param {HTMLTableElement} table
	 * @param {typeof DEFAULT_OPTIONS} options
	 */
	function ScanCurrentPageTable( table, options )
	{
		discoveredLicenses = [];

		// Ensure table header has checkbox column
		const thead = table.querySelector( 'thead' ) || table.querySelector( 'tr' );
		if( thead && !thead.querySelector( '.sdc-header-checkbox' ) )
		{
			const th = document.createElement( 'th' );
			th.className = 'sdc-col-checkbox sdc-header-checkbox';
			const masterCb = document.createElement( 'input' );
			masterCb.type = 'checkbox';
			masterCb.className = 'sdc-checkbox';
			masterCb.title = 'Select / Deselect all visible';
			masterCb.addEventListener( 'change', () =>
			{
				table.querySelectorAll( 'tbody tr' ).forEach( ( tr ) =>
				{
					if( tr.style.display !== 'none' )
					{
						const cb = tr.querySelector( '.sdc-checkbox' );
						if( cb )
						{
							cb.checked = masterCb.checked;
							if( masterCb.checked ) tr.classList.add( 'sdc-row-marked' );
							else tr.classList.remove( 'sdc-row-marked' );
						}
					}
				} );
				UpdateSelectedCount();
			} );
			th.appendChild( masterCb );
			thead.insertBefore( th, thead.firstChild );
		}

		const rows = table.querySelectorAll( 'tr' );

		for( const row of rows )
		{
			// Skip the header row
			if( row.querySelector( 'th' ) ) continue;

			// Add checkbox cell if not present
			if( !row.querySelector( '.sdc-col-checkbox' ) )
			{
				const td = document.createElement( 'td' );
				td.className = 'sdc-col-checkbox';
				row.insertBefore( td, row.firstChild );
			}

			if( row.cells.length < 3 ) continue;

			const nameCell = row.cells[ 2 ]; // Index 2 because checkbox was prepended
			const removeLink = nameCell.querySelector( '.free_license_remove_link a' );

			if( removeLink )
			{
				const packageid = ExtractPackageId( removeLink.getAttribute( 'href' ) || removeLink.outerHTML );

				if( packageid )
				{
					const rawTitle = nameCell.textContent.replace( 'Remove', '' ).trim().replace( /[\r\n\t]+/g, ' ' );
					const classification = ClassifyLicense( rawTitle, options.keywords );

					const licenseData = {
						packageid,
						title: rawTitle,
						category: classification.category,
						rowEl: row,
						elementRemove: removeLink
					};

					discoveredLicenses.push( licenseData );

					// Add Checkbox to row
					const cbCell = row.cells[ 0 ];
					cbCell.innerHTML = '';
					const checkbox = document.createElement( 'input' );
					checkbox.type = 'checkbox';
					checkbox.className = 'sdc-checkbox';
					checkbox.dataset.packageid = packageid.toString();
					checkbox.addEventListener( 'change', () =>
					{
						if( checkbox.checked ) row.classList.add( 'sdc-row-marked' );
						else row.classList.remove( 'sdc-row-marked' );
						UpdateSelectedCount();
					} );
					cbCell.appendChild( checkbox );

					// Add category badge
					if( !nameCell.querySelector( '.sdc-badge' ) )
					{
						const badge = document.createElement( 'span' );
						badge.className = `sdc-badge sdc-badge-${classification.category}`;
						badge.textContent = classification.category.toUpperCase();
						nameCell.appendChild( badge );

						// SteamDB Sub ID badge/link
						const subLink = document.createElement( 'a' );
						subLink.className = 'sdc-subid-link';
						subLink.target = '_blank';
						subLink.href = `https://steamdb.info/sub/${packageid}/`;
						subLink.textContent = `#${packageid}`;
						subLink.title = 'View package on SteamDB';
						nameCell.appendChild( subLink );

						// Quick single-remove button
						const quickRemove = document.createElement( 'button' );
						quickRemove.className = 'sdc-quick-remove-btn';
						quickRemove.textContent = 'Clean';
						quickRemove.title = 'Remove this license immediately';
						quickRemove.addEventListener( 'click', ( e ) =>
						{
							e.preventDefault();
							e.stopPropagation();
							SingleLicenseRemoval( licenseData, options );
						} );
						nameCell.appendChild( quickRemove );
					}
				}
			}
		}

		UpdateDashboardCounts();
	}

	/**
	 * Filter rows in real-time based on active category pill and search query
	 * @param {HTMLTableElement} table
	 */
	function ApplyFiltersAndSearch( table )
	{
		const rows = table.querySelectorAll( 'tbody tr' );

		rows.forEach( ( tr ) =>
		{
			const cb = tr.querySelector( '.sdc-checkbox' );
			if( !cb ) return;

			const packageid = Number.parseInt( cb.dataset.packageid, 10 );
			const item = discoveredLicenses.find( l => l.packageid === packageid );

			if( !item )
			{
				tr.style.display = '';
				return;
			}

			let matchesCategory = true;
			if( activeFilter === 'demo' ) matchesCategory = ( item.category === 'demo' );
			else if( activeFilter === 'playtest' ) matchesCategory = ( item.category === 'playtest' );
			else if( activeFilter === 'prologue' ) matchesCategory = ( item.category === 'prologue' );
			else if( activeFilter === 'beta' ) matchesCategory = ( item.category === 'beta' );
			else if( activeFilter === 'other' ) matchesCategory = ( item.category === 'other' );
			else if( activeFilter === 'selected' ) matchesCategory = cb.checked;

			let matchesSearch = true;
			if( searchQuery )
			{
				const titleMatch = item.title.toLowerCase().includes( searchQuery );
				const idMatch = item.packageid.toString().includes( searchQuery );
				matchesSearch = ( titleMatch || idMatch );
			}

			if( matchesCategory && matchesSearch )
			{
				tr.style.display = '';
			}
			else
			{
				tr.style.display = 'none';
			}
		} );
	}

	/**
	 * Update statistics counters in dashboard
	 */
	function UpdateDashboardCounts()
	{
		const total = discoveredLicenses.length;
		const demos = discoveredLicenses.filter( l => l.category === 'demo' ).length;
		const playtests = discoveredLicenses.filter( l => l.category === 'playtest' ).length;
		const prologues = discoveredLicenses.filter( l => l.category === 'prologue' ).length;
		const betas = discoveredLicenses.filter( l => l.category === 'beta' ).length;
		const other = discoveredLicenses.filter( l => l.category === 'other' ).length;

		document.getElementById( 'sdc-stat-total' ).textContent = total;
		document.getElementById( 'sdc-stat-demos' ).textContent = demos;
		document.getElementById( 'sdc-stat-playtests' ).textContent = playtests;

		document.getElementById( 'sdc-pill-all' ).textContent = total;
		document.getElementById( 'sdc-pill-demos' ).textContent = demos;
		document.getElementById( 'sdc-pill-playtests' ).textContent = playtests;
		document.getElementById( 'sdc-pill-prologues' ).textContent = prologues;
		document.getElementById( 'sdc-pill-betas' ).textContent = betas;
		document.getElementById( 'sdc-pill-other' ).textContent = other;

		UpdateSelectedCount();
	}

	/**
	 * Update selected items counter and action button
	 */
	function UpdateSelectedCount()
	{
		const selected = GetSelectedLicenses();
		const count = selected.length;

		document.getElementById( 'sdc-stat-selected' ).textContent = count;
		document.getElementById( 'sdc-pill-selected' ).textContent = count;
		document.getElementById( 'sdc-btn-count' ).textContent = count;

		const cleanBtn = document.getElementById( 'sdc-btn-clean-selected' );
		cleanBtn.disabled = ( count === 0 );
	}

	/**
	 * Get array of currently checked licenses
	 * @returns {Array<typeof discoveredLicenses[0]>}
	 */
	function GetSelectedLicenses()
	{
		const checkedBoxes = document.querySelectorAll( '.sdc-checkbox:checked' );
		const selected = [];

		checkedBoxes.forEach( ( cb ) =>
		{
			const pid = Number.parseInt( cb.dataset.packageid, 10 );
			const item = discoveredLicenses.find( l => l.packageid === pid );
			if( item ) selected.push( item );
		} );

		return selected;
	}

	/**
	 * Remove a single license immediately
	 * @param {typeof discoveredLicenses[0]} item
	 * @param {typeof DEFAULT_OPTIONS} options
	 */
	function SingleLicenseRemoval( item, options )
	{
		if( options.confirmBeforeDelete )
		{
			if( !confirm( `Are you sure you want to remove "${item.title}" (#${item.packageid}) from your Steam account?` ) )
			{
				return;
			}
		}

		if( item.rowEl ) item.rowEl.classList.add( 'sdc-row-removing' );

		SendMessageToBackgroundScript( {
			contentScriptQuery: 'RemoveLicense',
			packageid: item.packageid,
			title: item.title
		}, ( response ) =>
		{
			if( response && response.success )
			{
				AnimateRowRemoval( item );
				SendMessageToBackgroundScript( {
					contentScriptQuery: 'SaveRemovalLog',
					items: [ { packageid: item.packageid, title: item.title, timestamp: Date.now() } ]
				} );
			}
			else
			{
				if( item.rowEl ) item.rowEl.classList.remove( 'sdc-row-removing' );
				alert( `Failed to remove ${item.title}: ${response?.error || 'Unknown error'}` );
			}
		} );
	}

	/**
	 * Prompt user and start batch removal sequence
	 * @param {Array<typeof discoveredLicenses[0]>} items
	 * @param {typeof DEFAULT_OPTIONS} options
	 */
	function PromptAndStartRemoval( items, options )
	{
		if( items.length === 0 ) return;

		if( options.confirmBeforeDelete )
		{
			const msg = `You are about to remove ${items.length} licenses from your Steam account.\n\n` +
				`This includes ${items.filter( i => i.category === 'demo' ).length} demos and ` +
				`${items.filter( i => i.category === 'playtest' ).length} playtests.\n\n` +
				`Proceed with batch removal?`;

			if( !confirm( msg ) ) return;
		}

		if( options.autoBackup )
		{
			ExportBackupData( items );
		}

		ShowRemovalModal( items, options );
	}

	/**
	 * Render and execute modal batch removal
	 * @param {Array<typeof discoveredLicenses[0]>} items
	 * @param {typeof DEFAULT_OPTIONS} options
	 */
	function ShowRemovalModal( items, options )
	{
		isRemovalInProgress = true;
		isPaused = false;
		abortRemoval = false;

		const overlay = document.createElement( 'div' );
		overlay.id = 'sdc-modal-overlay';

		overlay.innerHTML = `
			<div class="sdc-modal">
				<div class="sdc-modal-header">
					<div class="sdc-modal-title">🧹 Cleaning Steam Licenses...</div>
					<div id="sdc-modal-counter">0 / ${items.length}</div>
				</div>

				<div class="sdc-modal-body">
					<div class="sdc-progress-track">
						<div class="sdc-progress-bar" id="sdc-progress-bar"></div>
					</div>

					<div class="sdc-progress-stats">
						<span id="sdc-progress-pct">0% Complete</span>
						<span id="sdc-progress-eta">Processing...</span>
					</div>

					<div class="sdc-current-item" id="sdc-current-item">
						Preparing removal queue...
					</div>

					<div class="sdc-log-box" id="sdc-log-box"></div>
				</div>

				<div class="sdc-modal-footer">
					<button type="button" class="sdc-btn sdc-btn-secondary" id="sdc-btn-pause">Pause</button>
					<button type="button" class="sdc-btn sdc-btn-danger" id="sdc-btn-cancel">Cancel</button>
				</div>
			</div>
		`;

		document.body.appendChild( overlay );

		const progressBar = document.getElementById( 'sdc-progress-bar' );
		const progressPct = document.getElementById( 'sdc-progress-pct' );
		const currentItemEl = document.getElementById( 'sdc-current-item' );
		const counterEl = document.getElementById( 'sdc-modal-counter' );
		const logBox = document.getElementById( 'sdc-log-box' );
		const pauseBtn = document.getElementById( 'sdc-btn-pause' );
		const cancelBtn = document.getElementById( 'sdc-btn-cancel' );

		pauseBtn.addEventListener( 'click', () =>
		{
			isPaused = !isPaused;
			pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
			pauseBtn.classList.toggle( 'sdc-btn-primary', isPaused );
			AppendLog( logBox, isPaused ? '⏸️ Queue paused by user.' : '▶️ Resuming removal queue...', 'info' );
		} );

		cancelBtn.addEventListener( 'click', () =>
		{
			abortRemoval = true;
			cancelBtn.disabled = true;
			cancelBtn.textContent = 'Stopping...';
			AppendLog( logBox, '🛑 Aborting remaining queue items...', 'warn' );
		} );

		// Execute sequential removal
		( async() =>
		{
			let successful = 0;
			let failed = 0;
			const removedHistoryBatch = [];

			for( let i = 0; i < items.length; i++ )
			{
				if( abortRemoval ) break;

				while( isPaused )
				{
					await new Promise( r => setTimeout( r, 300 ) );
					if( abortRemoval ) break;
				}
				if( abortRemoval ) break;

				const item = items[ i ];
				const currentNum = i + 1;
				const pct = Math.round( ( currentNum / items.length ) * 100 );

				progressBar.style.width = `${pct}%`;
				progressPct.textContent = `${pct}% Complete (${successful} cleaned, ${failed} failed)`;
				counterEl.textContent = `${currentNum} / ${items.length}`;
				currentItemEl.textContent = `Removing: ${item.title} (#${item.packageid})`;

				if( item.rowEl ) item.rowEl.classList.add( 'sdc-row-removing' );

				// Send removal to background script
				const result = await new Promise( ( resolve ) =>
				{
					SendMessageToBackgroundScript( {
						contentScriptQuery: 'RemoveLicense',
						packageid: item.packageid,
						title: item.title
					}, resolve );
				} );

				if( result && result.success )
				{
					successful++;
					AppendLog( logBox, `✓ [${currentNum}/${items.length}] Removed: ${item.title}`, 'success' );
					AnimateRowRemoval( item );
					removedHistoryBatch.push( { packageid: item.packageid, title: item.title, timestamp: Date.now() } );
				}
				else if( result && result.rateLimited )
				{
					AppendLog( logBox, `⚠️ Rate limited by Steam on #${item.packageid}. Waiting 60s before retry...`, 'warn' );
					for( let s = 60; s > 0; s-- )
					{
						if( abortRemoval ) break;
						currentItemEl.textContent = `Rate limited: Waiting ${s} seconds before retrying...`;
						await new Promise( r => setTimeout( r, 1000 ) );
					}
					i--; // retry current index
					continue;
				}
				else if( result && result.requiresLogin )
				{
					AppendLog( logBox, `❌ Session expired. Please log in again to Steam.`, 'error' );
					alert( 'Your Steam session has expired. Please refresh the page and log in again.' );
					break;
				}
				else
				{
					failed++;
					AppendLog( logBox, `✗ Failed to remove: ${item.title} (${result?.error || 'Unknown error'})`, 'error' );
					if( item.rowEl ) item.rowEl.classList.remove( 'sdc-row-removing' );
				}

				// Gentle delay between requests
				await new Promise( r => setTimeout( r, options.requestDelay || 1000 ) );
			}

			// Invalidate Steam cache via injected script
			window.postMessage( { type: 'sdc:invalidate_cache' }, window.location.origin );

			// Persist history log
			if( removedHistoryBatch.length > 0 )
			{
				SendMessageToBackgroundScript( {
					contentScriptQuery: 'SaveRemovalLog',
					items: removedHistoryBatch
				} );
			}

			isRemovalInProgress = false;
			currentItemEl.textContent = `Completed! Successfully cleaned ${successful} items (${failed} errors).`;
			pauseBtn.style.display = 'none';
			cancelBtn.textContent = 'Close';
			cancelBtn.disabled = false;
			cancelBtn.classList.remove( 'sdc-btn-danger' );
			cancelBtn.classList.add( 'sdc-btn-primary' );
			cancelBtn.onclick = () => overlay.remove();
		} )();
	}

	/**
	 * Append a colored line to the modal activity log
	 * @param {HTMLElement} logBox
	 * @param {string} text
	 * @param {'info'|'success'|'warn'|'error'} type
	 */
	function AppendLog( logBox, text, type = 'info' )
	{
		const line = document.createElement( 'div' );
		line.className = `sdc-log-line sdc-log-${type}`;
		const time = new Date().toLocaleTimeString( [], { hour: '2-digit', minute: '2-digit', second: '2-digit' } );
		line.textContent = `[${time}] ${text}`;
		logBox.appendChild( line );
		logBox.scrollTop = logBox.scrollHeight;
	}

	/**
	 * Smoothly animate row removal and update counters
	 * @param {typeof discoveredLicenses[0]} item
	 */
	function AnimateRowRemoval( item )
	{
		if( item.rowEl )
		{
			item.rowEl.classList.add( 'sdc-row-removed' );
			setTimeout( () =>
			{
				if( item.rowEl.parentNode ) item.rowEl.remove();
			}, 400 );
		}

		discoveredLicenses = discoveredLicenses.filter( l => l.packageid !== item.packageid );
		UpdateDashboardCounts();
	}

	/**
	 * Scan all paginated license pages
	 * @param {HTMLTableElement} table
	 * @param {typeof DEFAULT_OPTIONS} options
	 */
	async function ScanAllPages( table, options )
	{
		if( isScanInProgress ) return;
		isScanInProgress = true;

		const scanBtn = document.getElementById( 'sdc-btn-scan-all-pages' );
		const originalText = scanBtn.textContent;
		scanBtn.disabled = true;

		let nextHref = '';
		let pageNum = 1;
		let hasMorePages = true;

		// Check initial paginator next button
		const initialNext = document.querySelector( '.license_paginator_next' );
		if( !initialNext )
		{
			alert( 'All licenses are already displayed on this single page.' );
			scanBtn.disabled = false;
			isScanInProgress = false;
			return;
		}

		nextHref = initialNext.getAttribute( 'href' );

		while( hasMorePages && nextHref )
		{
			pageNum++;
			scanBtn.textContent = `Scanning Page ${pageNum}...`;

			const targetUrl = `https://store.steampowered.com/account/licenses/${nextHref}`;
			const response = await new Promise( ( resolve ) =>
			{
				SendMessageToBackgroundScript( {
					contentScriptQuery: 'FetchLicensesPage',
					url: targetUrl
				}, resolve );
			} );

			if( !response || !response.success || !response.html )
			{
				WriteLog( `Failed to load page ${pageNum}` );
				break;
			}

			const doc = new DOMParser().parseFromString( response.html, 'text/html' );
			const pageTable = doc.querySelector( '.account_table' );

			if( pageTable )
			{
				const pageRows = pageTable.querySelectorAll( 'tr' );
				pageRows.forEach( ( row ) =>
				{
					if( row.querySelector( 'th' ) ) return;
					if( row.cells.length < 2 ) return;

					const nameCell = row.cells[ 1 ];
					const removeLink = nameCell.querySelector( '.free_license_remove_link a' );

					if( removeLink )
					{
						const packageid = ExtractPackageId( removeLink.getAttribute( 'href' ) || removeLink.outerHTML );
						if( packageid && !discoveredLicenses.some( l => l.packageid === packageid ) )
						{
							const rawTitle = nameCell.textContent.replace( 'Remove', '' ).trim().replace( /[\r\n\t]+/g, ' ' );
							const classification = ClassifyLicense( rawTitle, options.keywords );

							// Append row to current active table DOM so user can inspect and remove it!
							const importedRow = document.importNode( row, true );

							// Insert checkbox cell
							const cbTd = document.createElement( 'td' );
							cbTd.className = 'sdc-col-checkbox';
							const checkbox = document.createElement( 'input' );
							checkbox.type = 'checkbox';
							checkbox.className = 'sdc-checkbox';
							checkbox.dataset.packageid = packageid.toString();
							checkbox.addEventListener( 'change', () =>
							{
								if( checkbox.checked ) importedRow.classList.add( 'sdc-row-marked' );
								else importedRow.classList.remove( 'sdc-row-marked' );
								UpdateSelectedCount();
							} );
							cbTd.appendChild( checkbox );
							importedRow.insertBefore( cbTd, importedRow.firstChild );

							const impNameCell = importedRow.cells[ 2 ];

							// Add badge
							const badge = document.createElement( 'span' );
							badge.className = `sdc-badge sdc-badge-${classification.category}`;
							badge.textContent = classification.category.toUpperCase();
							impNameCell.appendChild( badge );

							// Sub link
							const subLink = document.createElement( 'a' );
							subLink.className = 'sdc-subid-link';
							subLink.target = '_blank';
							subLink.href = `https://steamdb.info/sub/${packageid}/`;
							subLink.textContent = `#${packageid}`;
							impNameCell.appendChild( subLink );

							// License data entry
							const licenseItem = {
								packageid,
								title: rawTitle,
								category: classification.category,
								rowEl: importedRow,
								elementRemove: removeLink
							};

							// Quick remove
							const quickRemove = document.createElement( 'button' );
							quickRemove.className = 'sdc-quick-remove-btn';
							quickRemove.textContent = 'Clean';
							quickRemove.addEventListener( 'click', ( e ) =>
							{
								e.preventDefault();
								e.stopPropagation();
								SingleLicenseRemoval( licenseItem, options );
							} );
							impNameCell.appendChild( quickRemove );

							table.querySelector( 'tbody' ).appendChild( importedRow );
							discoveredLicenses.push( licenseItem );
						}
					}
				} );
			}

			const nextLink = doc.querySelector( '.license_paginator_next' );
			if( nextLink )
			{
				nextHref = nextLink.getAttribute( 'href' );
				await new Promise( r => setTimeout( r, 300 ) );
			}
			else
			{
				hasMorePages = false;
			}
		}

		scanBtn.textContent = '✓ All Pages Loaded';
		setTimeout( () =>
		{
			scanBtn.textContent = originalText;
			scanBtn.disabled = false;
		}, 3000 );

		isScanInProgress = false;
		UpdateDashboardCounts();
		ApplyFiltersAndSearch( table );
	}

	/**
	 * Export removable items to downloadable JSON backup
	 * @param {Array<typeof discoveredLicenses[0]>} [itemsToExport]
	 */
	function ExportBackupData( itemsToExport )
	{
		const list = itemsToExport || discoveredLicenses;
		if( list.length === 0 )
		{
			alert( 'No removable licenses found to export.' );
			return;
		}

		const data = {
			exportDate: new Date().toISOString(),
			totalItems: list.length,
			items: list.map( i => ( {
				packageid: i.packageid,
				title: i.title,
				category: i.category,
				steamdbUrl: `https://steamdb.info/sub/${i.packageid}/`
			} ) )
		};

		const blob = new Blob( [ JSON.stringify( data, null, 2 ) ], { type: 'application/json' } );
		const url = URL.createObjectURL( blob );
		const a = document.createElement( 'a' );
		a.href = url;
		a.download = `steam_licenses_backup_${new Date().toISOString().split( 'T' )[ 0 ]}.json`;
		document.body.appendChild( a );
		a.click();
		a.remove();
		URL.revokeObjectURL( url );
	}
} )();
