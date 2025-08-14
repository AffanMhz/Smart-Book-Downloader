// Analytics for Book Downloader
// Tracks failed searches to improve the book collection

// Google Sheet Web App URL 

/**
 * Tracks book searches that returned no results
 * Sends the data to a Google Sheet for later analysis
 * @param {string} query - The book title/query that yielded no results
 */
const FAILED_SEARCH_ENDPOINT = "https://script.google.com/macros/s/AKfycbz9MwBe7_q4ab1tJRBU9LlJEgmo7AeQOR8jY3hjVj4NvjxTlqGPEAq4b2s01OjGMHFP/exec";
function trackFailedSearch(query) {
  // Only log if we have a valid query
  if (!query || query.trim().length < 2) return;
  
  // Prepare the data to send
  const data = {
    query: query,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    referrer: document.referrer || "direct",
    // Add any additional data you might want to track
    language: navigator.language || navigator.userLanguage || "unknown",
    screen_size: `${window.innerWidth}x${window.innerHeight}`,
    search_page: window.location.href
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
  }).then(response => {
    console.log("Analytics data sent successfully");
  }).catch(err => {
    // Silent fail - we don't want to affect user experience
    console.log("Failed to log search data", err);
    
    // Store failed analytics in localStorage as backup
    storeFailedAnalyticsLocally(data);
  });
}

/**
 * Stores failed analytics data in localStorage as backup
 * In case the Google Sheets API call fails
 */
function storeFailedAnalyticsLocally(data) {
  try {
    // Get existing failed analytics or initialize empty array
    const failedAnalytics = JSON.parse(localStorage.getItem('failedSearchAnalytics') || '[]');
    
    // Add this data to the array
    failedAnalytics.push({
      ...data,
      storedAt: new Date().toISOString()
    });
    
    // Keep only the last 50 entries to avoid localStorage limits
    const trimmedAnalytics = failedAnalytics.slice(-50);
    
    // Store back in localStorage
    localStorage.setItem('failedSearchAnalytics', JSON.stringify(trimmedAnalytics));
    
    console.log(`Stored failed analytics locally. Total stored: ${trimmedAnalytics.length}`);
  } catch (error) {
    console.log("Error storing analytics locally:", error);
  }
}

/**
 * Attempts to resend any analytics data stored locally
 * from previous failed attempts
 */
function retrySendingFailedAnalytics() {
  try {
    // Check if we have any stored failed analytics
    const failedAnalytics = JSON.parse(localStorage.getItem('failedSearchAnalytics') || '[]');
    
    if (failedAnalytics.length === 0) return;
    
    console.log(`Found ${failedAnalytics.length} failed analytics records. Attempting to resend.`);
    
    // Create a copy of the array before modifying
    const analytics = [...failedAnalytics];
    
    // Clear storage to avoid duplicate sends if this succeeds
    localStorage.removeItem('failedSearchAnalytics');
    
    // Try to send each failed analytics record
    analytics.forEach(data => {
      fetch(FAILED_SEARCH_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      }).catch(err => {
        // If still failing, store it again
        storeFailedAnalyticsLocally(data);
      });
    });
  } catch (error) {
    console.log("Error retrying failed analytics:", error);
  }
}

// Add event listener to watch for the custom event when no results are found
document.addEventListener('DOMContentLoaded', function() {
  console.log("Analytics module loaded and listening for failed searches");
  
  // Listen for our custom event that fires when no books are found
  document.addEventListener('noBookResults', function(e) {
    trackFailedSearch(e.detail.query);
  });
  
  // Try to send any previously failed analytics after page load
  // Wait 3 seconds to ensure page is fully loaded and network is stable
  setTimeout(retrySendingFailedAnalytics, 3000);
});
