import stkData from './stk_data.json';
import smeData from './sme_data.json';

export type InspectionType = 'STK' | 'SME';

export interface StationInfo {
	id: string;
	provozovatel: string;
	street: string;
	town: string;
	zip: string;
}

interface StationDataEntry {
	id: string;
	provozovatel: string;
	street: string;
	town: string;
	zip: string;
}

// Build lookup maps for O(1) access
const stkMap = new Map<string, StationInfo>(
	(stkData as StationDataEntry[]).map((entry) => [entry.id, entry])
);

const smeMap = new Map<string, StationInfo>(
	(smeData as StationDataEntry[]).map((entry) => [entry.id, entry])
);

/**
 * Extracts the station code from a protocol number.
 * Protocol format: CZ-XXXX-YY-MM-NNNN (for STK) or CZ-XXXXXX-YY-MM-NNNN (for SME)
 * Where XXXX or XXXXXX is the station code.
 * 
 * @param protocolNumber - The full protocol number string
 * @returns The extracted station code or null if not found
 */
export function extractStationCode(protocolNumber: string): string | null {
	if (!protocolNumber) return null;
	
	// Protocol format: CZ-XXXX-YY-MM-NNNN or CZ-XXXXXX-YY-MM-NNNN
	const match = protocolNumber.match(/^CZ-(\d+)-\d{2}-\d{2}-\d+$/);
	return match?.[1] ?? null;
}

/**
 * Looks up station information based on the station code and inspection type.
 * 
 * @param stationCode - The station code extracted from the protocol number
 * @param inspectionType - The type of inspection ('STK' or 'SME')
 * @returns The station information or null if not found
 */
export function lookupStation(stationCode: string, inspectionType: InspectionType): StationInfo | null {
	if (!stationCode) return null;
	
	const map = inspectionType === 'STK' ? stkMap : smeMap;
	return map.get(stationCode) ?? null;
}

/**
 * Formats station information into a human-readable string.
 * 
 * @param station - The station information object
 * @returns A formatted string with the station details
 */
export function formatStationInfo(station: StationInfo): string {
	return `${station.provozovatel}, ${station.street}, ${station.zip} ${station.town}`;
}

/**
 * Gets the inspection location from a protocol number and inspection type.
 * This is the main function to use for adding "Místo kontroly" to the UI.
 * 
 * @param protocolNumber - The full protocol number string
 * @param inspectionType - The type of inspection ('STK' or 'SME')
 * @returns Formatted station location string or null if not found
 */
export function getInspectionLocation(protocolNumber: string, inspectionType: InspectionType): string | null {
	const stationCode = extractStationCode(protocolNumber);
	if (!stationCode) return null;
	
	const station = lookupStation(stationCode, inspectionType);
	if (!station) return null;
	
	return formatStationInfo(station);
}

/**
 * Adds "Místo kontroly" row to the inspection detail modal.
 * Call this function when the modal content is being populated.
 */
export function addLocationToDetailModal(): void {
	// Observer to watch for modal content changes
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === 'childList') {
				const modalBody = document.querySelector('.modal[data-modal="inspection-detail"] .modal-body');
				if (!modalBody) continue;
				
				const table = modalBody.querySelector('table.table-bordered tbody');
				if (!table) continue;
				
				// Check if we already added the location row
				if (table.querySelector('[data-location-row]')) continue;
				
				// Find the protocol number from the modal title
				const modalTitle = document.querySelector('.modal[data-modal="inspection-detail"] .modal-title');
				const titleText = modalTitle?.textContent ?? '';
				const protocolMatch = titleText.match(/CZ-[\d-]+/);
				const protocolNumber = protocolMatch?.[0] ?? '';
				
				// Find inspection type from the table
				const inspectionTypeRow = Array.from(table.querySelectorAll('tr')).find(
					(row) => row.querySelector('td')?.textContent?.trim() === 'Prohlídka'
				);
				const inspectionType = inspectionTypeRow?.querySelector('td:last-child')?.textContent?.trim() as InspectionType | undefined;
				
				if (!protocolNumber || !inspectionType) continue;
				
				const location = getInspectionLocation(protocolNumber, inspectionType);
				if (!location) continue;
				
				// Find the row after "Číslo protokolu" to insert our new row
				const protocolRow = Array.from(table.querySelectorAll('tr')).find(
					(row) => row.querySelector('td')?.textContent?.includes('Číslo protokolu') ||
					         row.querySelector('td')?.textContent?.includes('protokolu')
				);
				
				// Create the new row
				const newRow = document.createElement('tr');
				newRow.setAttribute('data-location-row', 'true');
				newRow.innerHTML = `
					<td class="fitwidth">Místo kontroly</td>
					<td>${location}</td>
				`;
				
				// Insert after protocol row, or at the beginning if not found
				if (protocolRow) {
					protocolRow.insertAdjacentElement('afterend', newRow);
				} else {
					table.insertBefore(newRow, table.firstChild);
				}
			}
		}
	});
	
	// Start observing the document for modal changes
	observer.observe(document.body, {
		childList: true,
		subtree: true
	});
}

/**
 * Adds "Místo kontroly" column to the inspection table.
 * This enriches the main table with location information.
 */
export function addLocationToTable(): void {
	const table = document.getElementById('inspectionTable');
	if (!table) return;
	
	const thead = table.querySelector('thead tr');
	const tbody = table.querySelector('tbody');
	if (!thead || !tbody) return;
	
	// Check if column already exists
	if (thead.querySelector('[data-location-header]')) return;
	
	// Add header column as 3rd column (after "Prohlídka")
	const headerCells = thead.querySelectorAll('th');
	const thirdHeader = headerCells[2]; // Insert before 3rd header (0-indexed: "Číslo protokolu")
	const newHeader = document.createElement('th');
	newHeader.setAttribute('data-location-header', 'true');
	newHeader.className = 'sorting_disabled';
	newHeader.textContent = 'Místo kontroly';
	thirdHeader?.insertAdjacentElement('beforebegin', newHeader);
	
	// Add data cells to each row
	const rows = tbody.querySelectorAll('tr');
	rows.forEach((row) => {
		// Get protocol number from the row
		const protocolCell = row.querySelector('td[data-protocol-number]');
		const protocolNumber = protocolCell?.textContent?.trim() ?? '';
		
		// Get inspection type from the row
		const inspectionKindCell = row.querySelector('td[data-inspection-kind-name]');
		const inspectionType = inspectionKindCell?.textContent?.trim() as InspectionType | undefined;
		
		// Look up the location
		let locationText = '-';
		if (protocolNumber && inspectionType) {
			const location = getInspectionLocation(protocolNumber, inspectionType);
			if (location) {
				locationText = location;
			}
		}
		
		// Create and insert the new cell as 3rd column
		const newCell = document.createElement('td');
		newCell.className = 'vertical-align-middle';
		newCell.setAttribute('data-location-cell', 'true');
		newCell.style.whiteSpace = 'nowrap';
		newCell.style.maxWidth = '250px';
		newCell.style.overflowX = 'auto';
		newCell.textContent = locationText;
		
		// Insert as 3rd column (after "Prohlídka")
		const cells = row.querySelectorAll('td');
		const thirdCell = cells[2]; // Insert before 3rd cell (0-indexed)
		thirdCell?.insertAdjacentElement('beforebegin', newCell);
	});
}

/**
 * Initialize station lookup functionality.
 * Call this on page load to add location information to the UI.
 */
export function initStationLookup(): void {
	addLocationToTable();
	addLocationToDetailModal();
}
