/**
 * Data Management System - Google Apps Script
 * This script handles web app requests and manages Google Sheets data
 * 
 * Instructions:
 * 1. Create a new Google Apps Script project
 * 2. Replace the default code with this script
 * 3. Create a Google Sheet and note its ID
 * 4. Update SHEET_ID variable below
 * 5. Deploy as web app with execute permissions for "Anyone"
 */

// Configuration - UPDATE THESE VALUES
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE'; // Replace with your actual Google Sheet ID
const SHEET_NAME = 'DataEntries'; // Name of the sheet tab

/**
 * Main function to handle HTTP requests (GET and POST)
 */
function doPost(e) {
  try {
    // Enable CORS
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let result;
    
    switch(action) {
      case 'addData':
        result = addDataToSheet(data.data);
        break;
      case 'getSummary':
        result = getDataSummary();
        break;
      case 'exportData':
        result = exportData();
        break;
      default:
        result = { success: false, message: 'Unknown action' };
    }
    
    output.setContent(JSON.stringify(result));
    return output;
    
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    const errorResponse = ContentService.createTextOutput();
    errorResponse.setMimeType(ContentService.MimeType.JSON);
    errorResponse.setContent(JSON.stringify({
      success: false,
      message: 'Server error: ' + error.toString()
    }));
    return errorResponse;
  }
}

/**
 * Handle GET requests for summary data
 */
function doGet(e) {
  try {
    const action = e.parameter.action || 'getSummary';
    
    let result;
    switch(action) {
      case 'getSummary':
        result = getDataSummary();
        break;
      case 'exportData':
        result = exportData();
        break;
      default:
        result = { success: false, message: 'Unknown action' };
    }
    
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    output.setContent(JSON.stringify(result));
    return output;
    
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    const errorResponse = ContentService.createTextOutput();
    errorResponse.setMimeType(ContentService.MimeType.JSON);
    errorResponse.setContent(JSON.stringify({
      success: false,
      message: 'Server error: ' + error.toString()
    }));
    return errorResponse;
  }
}

/**
 * Add new data entry to the Google Sheet
 */
function addDataToSheet(data) {
  try {
    const sheet = getOrCreateSheet();
    
    // Prepare the row data
    const timestamp = new Date();
    const rowData = [
      timestamp, // A: Timestamp
      data.name || '', // B: Name
      data.email || '', // C: Email
      data.phone || '', // D: Phone
      data.category || '', // E: Category
      data.priority || 'medium', // F: Priority
      data.date || '', // G: Date
      data.description || '', // H: Description
      'Active' // I: Status
    ];
    
    // Add the data to the sheet
    sheet.appendRow(rowData);
    
    // Get the total number of entries
    const totalEntries = sheet.getLastRow() - 1; // -1 for header row
    
    Logger.log('Data added successfully. Total entries: ' + totalEntries);
    
    return {
      success: true,
      message: 'Data added successfully!',
      totalEntries: totalEntries,
      timestamp: timestamp
    };
    
  } catch (error) {
    Logger.log('Error adding data: ' + error.toString());
    return {
      success: false,
      message: 'Error adding data: ' + error.toString()
    };
  }
}

/**
 * Get data summary and analytics
 */
function getDataSummary() {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return {
        success: true,
        totalEntries: 0,
        todayEntries: 0,
        categories: {},
        priorities: {},
        recentEntries: []
      };
    }
    
    // Remove header row
    const entries = data.slice(1);
    
    // Calculate statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let todayCount = 0;
    const categories = {};
    const priorities = {};
    const recentEntries = [];
    
    entries.forEach((row, index) => {
      const entryDate = new Date(row[0]);
      const category = row[4] || 'Other';
      const priority = row[5] || 'medium';
      
      // Count today's entries
      if (entryDate >= today) {
        todayCount++;
      }
      
      // Count categories
      categories[category] = (categories[category] || 0) + 1;
      
      // Count priorities
      priorities[priority] = (priorities[priority] || 0) + 1;
      
      // Get recent entries (last 5)
      if (index < 5) {
        recentEntries.push({
          name: row[1],
          email: row[2],
          category: category,
          priority: priority,
          date: row[6],
          timestamp: row[0]
        });
      }
    });
    
    return {
      success: true,
      totalEntries: entries.length,
      todayEntries: todayCount,
      categories: categories,
      priorities: priorities,
      recentEntries: recentEntries,
      lastUpdated: new Date()
    };
    
  } catch (error) {
    Logger.log('Error getting summary: ' + error.toString());
    return {
      success: false,
      message: 'Error getting summary: ' + error.toString()
    };
  }
}

/**
 * Export data functionality
 */
function exportData() {
  try {
    const sheet = getOrCreateSheet();
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    
    // Create export timestamp
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
    const exportFileName = `DataExport_${timestamp}`;
    
    // Get the spreadsheet URL for sharing
    const spreadsheetUrl = spreadsheet.getUrl();
    
    return {
      success: true,
      message: 'Export ready! You can download your data from the Google Sheet.',
      exportUrl: spreadsheetUrl,
      fileName: exportFileName,
      totalRecords: sheet.getLastRow() - 1
    };
    
  } catch (error) {
    Logger.log('Error exporting data: ' + error.toString());
    return {
      success: false,
      message: 'Error exporting data: ' + error.toString()
    };
  }
}

/**
 * Get or create the data sheet with proper headers
 */
function getOrCreateSheet() {
  let spreadsheet;
  
  try {
    spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  } catch (error) {
    throw new Error('Cannot access Google Sheet. Please check SHEET_ID and permissions.');
  }
  
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    // Create new sheet if it doesn't exist
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    
    // Add headers
    const headers = [
      'Timestamp',
      'Name',
      'Email',
      'Phone',
      'Category',
      'Priority',
      'Date',
      'Description',
      'Status'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format the header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
    
    Logger.log('Created new sheet: ' + SHEET_NAME);
  }
  
  return sheet;
}

/**
 * Test function to verify setup
 */
function testSetup() {
  try {
    const sheet = getOrCreateSheet();
    
    // Add test data
    const testData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '123-456-7890',
      category: 'personal',
      priority: 'medium',
      date: '2025-01-01',
      description: 'This is a test entry'
    };
    
    const result = addDataToSheet(testData);
    Logger.log('Test result: ' + JSON.stringify(result));
    
    const summary = getDataSummary();
    Logger.log('Summary result: ' + JSON.stringify(summary));
    
    return {
      success: true,
      message: 'Setup test completed successfully!',
      addResult: result,
      summaryResult: summary
    };
    
  } catch (error) {
    Logger.log('Test setup error: ' + error.toString());
    return {
      success: false,
      message: 'Test setup failed: ' + error.toString()
    };
  }
}

/**
 * Initialize the script and create necessary setup
 */
function onInstall() {
  try {
    const sheet = getOrCreateSheet();
    Logger.log('Script installed successfully. Sheet ready: ' + SHEET_NAME);
  } catch (error) {
    Logger.log('Installation error: ' + error.toString());
  }
}
