// Analytics for Book Downloader
// Tracks failed searches to improve the book collection

// Google Sheet Web App URL (replace with your actual deployed URL from Google Apps Script)
const FAILED_SEARCH_ENDPOINT = "https://script.google.com/macros/s/AKfycbxSoTmiNTEnGEJrlM8SthT-611iXH9TjokbXmnxDR5BQwfWtyVevq9c36He-39cYyoT/exec";

/**
 * Tracks book searches that returned no results
 * Sends the data to a Google Sheet for later analysis
 * @param {string} query - The book title/query that yielded no results
 */
function trackFailedSearch(query) {
  // Only log if we have a valid query
  if (!query || query.trim().length < 2) return;
  
  // Prepare the data to send
  const data = {
    query: query,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    referrer: document.referrer || "direct"
  };
  
  // Log to console for debugging
  console.log("Tracking failed search:", query);
  
  // Send the data to Google Sheets
  fetch(FAILED_SEARCH_ENDPOINT, {
    method: 'POST',
    mode: 'no-cors', // Important to avoid CORS issues with Google Apps Script
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  }).catch(err => {
    // Silent fail - we don't want to affect user experience
    console.log("Failed to log search data", err);
  });
}

// Add event listener to watch for the custom event when no results are found
document.addEventListener('DOMContentLoaded', function() {
  console.log("Analytics module loaded and listening for failed searches");
  
  // Listen for our custom event that fires when no books are found
  document.addEventListener('noBookResults', function(e) {
    trackFailedSearch(e.detail.query);
  });
});
