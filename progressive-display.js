// Handle progressive loading transitions
function transitionToProgressiveDisplay() {
    // Hide default placeholder
    document.getElementById('defaultPlaceholder').style.display = 'none';
    
    // Show results container
    document.getElementById('results').style.display = 'block';
    
    // This function is called when the first piece of data (book info) is ready
    showLoading(false); // Hide the main loading spinner
    startBackgroundLoading(); // Show the background loading for download links
}

// Display book information only
function displayBookInfo(bookInfo) {
    const bookInfoSection = document.getElementById('bookInfo');
    const bookDetails = document.getElementById('bookDetails');
    
    // Hide placeholder and show results container
    transitionToProgressiveDisplay();
    
    // Always show the book information section when we have book info
    bookInfoSection.style.display = 'block';
    
    // Add a nice fade-in animation
    bookInfoSection.style.opacity = '0';
    setTimeout(() => {
        bookInfoSection.style.transition = 'opacity 0.5s ease-in-out';
        bookInfoSection.style.opacity = '1';
    }, 10);
    
    // Prepare cover image HTML if available
    let coverHTML = '';
    if (bookInfo.coverId) {
        coverHTML = `
            <div class="book-cover">
                <img src="https://covers.openlibrary.org/b/id/${bookInfo.coverId}-M.jpg" 
                     alt="Cover for ${bookInfo.title}" 
                     class="cover-image"
                     onerror="this.style.display='none'">
            </div>
        `;
    }
    
    // Display book information with cover image
    bookDetails.innerHTML = `
        ${coverHTML}
        <div class="book-details-grid">
            <div class="book-detail">
                <strong>Title</strong>
                ${bookInfo.title}
            </div>
            <div class="book-detail">
                <strong>Author(s)</strong>
                ${bookInfo.author}
            </div>
            <div class="book-detail">
                <strong>First Published</strong>
                ${bookInfo.firstPublished}
            </div>
            <div class="book-detail">
                <strong>Language</strong>
                <span class="language-display" 
                      title="Click to see all languages" 
                      onclick="toggleAllLanguages(this, ${JSON.stringify(bookInfo.allLanguages || [])})">${bookInfo.language}</span>
            </div>
            <div class="book-detail">
                <strong>Publisher</strong>
                ${bookInfo.publisher}
            </div>
            <div class="book-detail">
                <strong>Subjects</strong>
                ${bookInfo.subjects}
            </div>
        </div>
    `;
}

// Display download links section
function displayDownloadLinks(bookInfo, downloadLinks) {
    const downloadLinksContainer = document.getElementById('downloadLinks');
    const resultCountElement = document.getElementById('resultCount');
    const bookInfoSection = document.getElementById('bookInfo');
    const downloadSection = document.querySelector('.download-section');
    
    // Make sure loading animations are stopped
    showLoading(false);
    stopBackgroundLoading();
    
    // Add a nice fade-in animation for the download section
    if (downloadSection) {
        downloadSection.style.opacity = '0';
        setTimeout(() => {
            downloadSection.style.transition = 'opacity 0.5s ease-in-out';
            downloadSection.style.opacity = '1';
        }, 10);
    }
    
    if (downloadLinks.length === 0) {
        // Dispatch event for analytics to track the failed search
        document.dispatchEvent(new CustomEvent('noBookResults', { 
            detail: { query: bookInfo.title } 
        }));
        
        resultCountElement.textContent = '(No results)';
        
        // Array of witty messages about paying for books
        const wittyMessages = [
            "Some wisdom comes with a price tag for a reason.",
            "Sometimes you just have to pay for knowledge!",
            "Not all treasures are free to share.",
            "Certain pages are priceless and priced accordingly.",
            "When the knowledge is rare, it's worth the fare.",
            "Some truths are too valuable to be given away.",
            "Premium insights demand a premium seat.",
            "Some chapters are worth every coin.",
            "Quality knowledge doesn't always come free.",
            "The rarest pages are the ones you invest in.",
            "Some lessons are premium for a reason.",
            "When the content is gold, expect a price.",
            "Exclusive wisdom comes with exclusive value.",
        ];
        
        // Get a random message from the array
        const randomMessage = wittyMessages[Math.floor(Math.random() * wittyMessages.length)];
        
        downloadLinksContainer.innerHTML = `
            <div class="no-results">
                <div style="text-align: center; width: 100%;">
                    <i data-lucide="book-open" style="width: 48px; height: 48px; margin-bottom: 15px; color: #6c757d; display: inline-block;"></i>
                </div>
                <h3>${randomMessage}</h3>
                
                <div class="purchase-links">
                    <h4>Where to buy this book:</h4>
                    <div class="purchase-buttons">
                        <a href="https://books.google.co.in/books?q=${encodeURIComponent(bookInfo.title + ' ' + bookInfo.author)}" target="_blank" class="purchase-btn google">
                            <i class="fa-brands fa-google"></i> Google Books
                        </a>
                        <a href="https://www.amazon.in/s?k=${encodeURIComponent(bookInfo.title + ' ' + bookInfo.author)}" target="_blank" class="purchase-btn amazon">
                            <i class="fa-brands fa-amazon"></i> Amazon India
                        </a>
                        <a href="https://www.flipkart.com/search?q=${encodeURIComponent(bookInfo.title + ' ' + bookInfo.author + ' book')}" target="_blank" class="purchase-btn flipkart">
                            <i class="fa-solid fa-shopping-cart"></i> Flipkart
                        </a>
                        <a href="https://www.bookdepository.com/search?searchTerm=${encodeURIComponent(bookInfo.title)}&search=Find+book" target="_blank" class="purchase-btn global">
                            <i class="fa-solid fa-globe"></i> Book Depository
                        </a>
                    </div>
                </div>
                
                <p class="no-results-message">We couldn't find any free downloads for "${bookInfo.title}". Time to support the authors!</p>
            </div>
        `;
    } else {
        // Display download links with count
        resultCountElement.textContent = `(${downloadLinks.length} result${downloadLinks.length !== 1 ? 's' : ''})`;
        downloadLinksContainer.innerHTML = downloadLinks.map(link => {
            const sourceClass = link.source.toLowerCase().replace(/\s+/g, '');
            return `
            <div class="download-link">
                <div class="link-header">
                    <div class="link-title">${link.title}</div>
                    <div class="link-source ${sourceClass}">${link.source}</div>
                </div>
                <div class="link-details">
                    Type: ${link.type} | Size: ${link.size}${link.author ? ` | Author: ${link.author}` : ''}
                </div>
                <div class="link-actions">
                    <button class="btn btn-download" onclick="openLink('${link.url}')">
                          <i class="fa-solid fa-download"></i> Download / Open
                        </button>

                    <button class="btn btn-copy" onclick="copyToClipboard('${link.url}')">
                      <i class="fa-regular fa-copy"></i> Copy Link
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }
    
    // Re-initialize icons for dynamically added content
    setTimeout(() => {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }, 100);
}
