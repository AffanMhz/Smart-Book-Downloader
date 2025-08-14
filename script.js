// Loading steps with professional + funny messages
const loadingSteps = [
    '🔧 Warming up the search engines...',
    '📚 Consulting the digital librarians...',
    '🤖 Teaching algorithms what books are...',
    '🕊️ Sending carrier pigeons to servers...',
    '🎯 Locating your needle in the haystack...',
    '🧠 Running fuzzy logic through coffee filters...',
    '📖 Asking books nicely to reveal themselves...',
    '🔮 Predicting your reading preferences...',
    '🚀 Launching quantum book detectors...',
    '🎭 Having philosophical discussions with PDFs...'
];

const backgroundLoadingSteps = [
    '🏗️ Building better results in the background...',
    '⚡ Supercharging search algorithms...',
    '🎨 Polishing the good stuff...',
    '🔍 Running advanced book forensics...',
    '🎪 Teaching PDFs new tricks...',
    '🕵️ Hunting for premium content...',
    '🎵 Harmonizing search frequencies...',
    '🧪 Brewing the perfect result cocktail...',
    '✨ Performing background magic...',
    '🚀 Launching secret sauce protocols...'
];

let currentStepIndex = 0;
let backgroundStepIndex = 0;
let isBackgroundLoading = false;

// Query normalization and variation functions
function normalizeQuery(query) {
    return query
        .toLowerCase()
        .trim()
        .replace(/[:\-\(\)\[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function removeStopwords(query) {
    const stopwords = ['the', 'and', 'of', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by'];
    return query.split(' ').filter(word => !stopwords.includes(word)).join(' ');
}

function generateQueryVariations(originalQuery, author = '') {
    const normalized = normalizeQuery(originalQuery);
    const variations = [
        originalQuery, // Exact as typed
        normalized,    // Normalized
        removeStopwords(normalized) // Without stopwords
    ];
    
    // Split on common subtitle separators
    if (normalized.includes(':')) {
        variations.push(normalized.split(':')[0].trim());
    }
    if (normalized.includes(' - ')) {
        variations.push(normalized.split(' - ')[0].trim());
    }
    
    // Try to detect "Title, Author" pattern
    if (normalized.includes(',')) {
        const parts = normalized.split(',');
        if (parts.length === 2) {
            variations.push(parts[0].trim()); // Just title
            variations.push(`${parts[0].trim()} ${parts[1].trim()}`); // Title + Author
            // Add PDF variations for detected title/author
            variations.push(`${parts[0].trim()} ${parts[1].trim()}.pdf`);
            variations.push(`${parts[0].trim()}.pdf`);
        }
    }
    
    // Add author-enhanced variations if provided
    if (author && author.toLowerCase() !== 'unknown author' && author.toLowerCase() !== 'unknown') {
        const cleanAuthor = author.replace(/,.*$/, '').trim(); // Remove everything after first comma
        variations.push(`${normalized} ${cleanAuthor}`);
        variations.push(`${normalized} ${cleanAuthor}.pdf`);
        variations.push(`"${normalized}" "${cleanAuthor}"`);
    }
    
    // Force PDF keyword variations - these are crucial for finding actual PDFs
    variations.push(`${normalized}.pdf`);
    variations.push(`${normalized} pdf`);
    variations.push(`"${normalized}.pdf"`);
    
    // Add filetype variations for better targeting
    variations.push(`${normalized} filetype:pdf`);
    if (author && author.toLowerCase() !== 'unknown author') {
        const cleanAuthor = author.replace(/,.*$/, '').trim();
        variations.push(`${normalized} ${cleanAuthor} filetype:pdf`);
    }
    
    // Remove duplicates and empty strings
    return [...new Set(variations)].filter(v => v.length > 0);
}

// Book search functionality
async function searchBooks(query, author = '') {
    const variations = generateQueryVariations(query, author);
    const pdfVariations = variations.filter(v => v.includes('.pdf') || v.includes('pdf'));
    const regularVariations = variations.filter(v => !v.includes('.pdf') && !v.includes('pdf'));
    const prioritizedVariations = [...pdfVariations, ...regularVariations];
    const links = [];
    
    try {
        for (const variant of prioritizedVariations) {
            const cleanVariant = variant.replace('.pdf', '').replace(' pdf', '').replace(' filetype:pdf', '');
            const encodedQuery = encodeURIComponent(cleanVariant);
            const response = await fetch(`https://gutendex.com/books/?search=${encodedQuery}`);
            if (!response.ok) continue;
            
            const data = await response.json();
            const books = data.results || [];
            
            for (const book of books.slice(0, 5)) {
                const title = book.title || 'Unknown Title';
                const author = book.authors.map(a => a.name).join(', ') || 'Unknown';
                const formats = book.formats || {};
                
                // Prioritize PDF formats first
                const pdfUrl = formats['application/pdf'];
                if (pdfUrl) {
                    links.push({
                        title,
                        author,
                        url: pdfUrl,
                        source: 'Project Gutenberg',
                        details: 'Public domain PDF',
                        downloadable: true
                    });
                }
                
                // Add other formats as fallback
                const epubUrl = formats['application/epub+zip'];
                if (epubUrl) {
                    links.push({
                        title,
                        author,
                        url: epubUrl,
                        source: 'Project Gutenberg',
                        details: 'Public domain EPUB',
                        downloadable: true
                    });
                }
                
                const htmlUrl = formats['text/html'];
                if (htmlUrl) {
                    links.push({
                        title,
                        author,
                        url: htmlUrl,
                        source: 'Project Gutenberg',
                        details: 'Read Online',
                        downloadable: false
                    });
                }
            }
        }
        return links;
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

// Main search function with progressive loading
async function searchBook() {
    const query = document.getElementById('bookSearch').value.trim();
    
    if (!query) {
        alert('Please enter a book title, author, or keyword.');
        return;
    }
    
    clearResults(false);
    showLoading(true);
    
    try {
        // Phase 1: Quick initial results (Open Library - fastest)
        console.log('Phase 1: Getting quick results...');
        const bookInfo = await getBookInfo(query);
        const quickLinks = await searchOpenLibrary(query);
        
        // Show initial results immediately
        if (quickLinks.length > 0) {
            displayResults(bookInfo, quickLinks);
            // Loading will be stopped by displayResults now
        } else if (quickLinks.length === 0) {
            // If no quick results, display the purchase options immediately
            displayResults(bookInfo, []);
            return; // Exit early, don't continue with background search
        }
        
        // Phase 2: Background loading of better sources with enhanced search
        startBackgroundLoading();
        
        const backgroundPromises = [
            searchInternetArchive(query, bookInfo),
            searchProjectGutenberg(query, bookInfo)
        ];
        
        const backgroundResults = await Promise.allSettled(backgroundPromises);
        const allLinks = [...quickLinks];
        
        // Add results from each background source as they complete
        backgroundResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                allLinks.push(...result.value);
                console.log(`Added ${result.value.length} results from source ${index + 1}`);
            }
        });
        
        // Apply fuzzy matching to all results
        const finalLinks = applyFuzzyMatching(allLinks, query);
        
        // Author fallback if still low results
        if (finalLinks.length < 5 && bookInfo.author && bookInfo.author !== 'Unknown Author') {
            console.log('Running author fallback...');
            const authorLinks = await searchDownloadLinks(bookInfo.author);
            const uniqueLinks = [...finalLinks, ...authorLinks].filter((link, index, arr) => 
                arr.findIndex(l => l.url === link.url) === index
            );
            finalLinks.splice(0, finalLinks.length, ...uniqueLinks.slice(0, 20));
        }
        
        // Update with final comprehensive results
        displayResults(bookInfo, finalLinks);
        stopBackgroundLoading();
        
    } catch (error) {
        console.error('Search error:', error);
        showError('Search failed: ' + error.message);
        // Make sure loading indicators are stopped
        showLoading(false);
        stopBackgroundLoading();
    }
}

function startBackgroundLoading() {
    // Don't start background loading if main loading is still active
    if (document.getElementById('loading').style.display === 'block') {
        return;
    }
    
    isBackgroundLoading = true;
    const loader = document.getElementById('backgroundLoader');
    loader.classList.add('show');
    
    backgroundStepIndex = 0;
    updateBackgroundLoadingStep();
    
    const stepInterval = setInterval(() => {
        if (!isBackgroundLoading) {
            clearInterval(stepInterval);
            return;
        }
        backgroundStepIndex = (backgroundStepIndex + 1) % backgroundLoadingSteps.length;
        updateBackgroundLoadingStep();
    }, 1200);
}

function stopBackgroundLoading() {
    isBackgroundLoading = false;
    const loader = document.getElementById('backgroundLoader');
    loader.classList.remove('show');
    
    // Remove partial results indicator
    const partial = document.querySelector('.results-partial');
    if (partial) partial.remove();
}

function updateBackgroundLoadingStep() {
    const textElement = document.getElementById('backgroundLoadingText');
    if (textElement && isBackgroundLoading) {
        textElement.textContent = backgroundLoadingSteps[backgroundStepIndex];
    }
}

async function getBookInfo(query) {
    // Language mapping for better display
    const languageMap = {
        'eng': 'English',
        'fre': 'French', 
        'fra': 'French',
        'spa': 'Spanish',
        'ger': 'German',
        'deu': 'German',
        'ita': 'Italian',
        'por': 'Portuguese',
        'rus': 'Russian',
        'jpn': 'Japanese',
        'chi': 'Chinese',
        'zho': 'Chinese',
        'ara': 'Arabic',
        'hin': 'Hindi',
        'kor': 'Korean',
        'dut': 'Dutch',
        'nld': 'Dutch',
        'swe': 'Swedish',
        'nor': 'Norwegian',
        'dan': 'Danish',
        'fin': 'Finnish',
        'pol': 'Polish',
        'tur': 'Turkish',
        'gre': 'Greek',
        'ell': 'Greek',
        'heb': 'Hebrew',
        'lat': 'Latin'
    };

    const variations = generateQueryVariations(query);
    
    try {
        // Try each variation until we get a good match
        for (const variant of variations) {
            const encodedQuery = encodeURIComponent(variant);
            const response = await fetch(`https://openlibrary.org/search.json?title=${encodedQuery}&limit=1`);
            
            if (!response.ok) continue;
            
            const data = await response.json();
            
            if (data.docs && data.docs.length > 0) {
                const book = data.docs[0];
                
                // Better language processing
                let languages = 'Not specified';
                if (book.language && book.language.length > 0) {
                    languages = book.language.slice(0, 3)
                        .map(code => languageMap[code] || code.charAt(0).toUpperCase() + code.slice(1))
                        .join(', ');
                }
                
                // Better subjects processing
                let subjects = 'Not specified';
                if (book.subject && book.subject.length > 0) {
                    subjects = book.subject
                        .filter(s => s && s.trim() !== '' && s.toLowerCase() !== 'not specified')
                        .slice(0, 5)
                        .join(', ') || 'Not specified';
                }
                
                // Better publisher processing (already fixed earlier)
                let publisher = 'Unknown';
                if (book.publisher && book.publisher.length > 0) {
                    publisher = book.publisher.slice(0, 2)
                        .filter(p => p && p.toLowerCase() !== 'specified' && p.toLowerCase() !== 'not specified' && p.trim() !== '')
                        .join(', ') || 'Unknown';
                }
                
                return {
                    title: book.title || query,
                    author: book.author_name ? book.author_name.join(', ') : 'Unknown Author',
                    firstPublished: book.first_publish_year || 'Unknown',
                    subjects,
                    language: languages,
                    publisher
                };
            }
        }
    } catch (error) {
        console.error('Error fetching book info:', error);
    }
    
    return {
        title: query,
        author: 'Unknown Author',
        firstPublished: 'Unknown',
        subjects: 'Not specified',
        language: 'Not specified',
        publisher: 'Unknown'
    };
}

async function searchDownloadLinks(query, bookInfo = null) {
    const links = [];
    
    // Search Internet Archive with smart queries
    try {
        const iaLinks = await searchInternetArchive(query, bookInfo);
        links.push(...iaLinks);
    } catch (error) {
        console.error('Internet Archive search failed:', error);
    }
    
    // Search Open Library
    try {
        const olLinks = await searchOpenLibrary(query);
        links.push(...olLinks);
    } catch (error) {
        console.error('Open Library search failed:', error);
    }
    
    // Search Project Gutenberg
    try {
        const pgLinks = await searchProjectGutenberg(query, bookInfo);
        links.push(...pgLinks);
    } catch (error) {
        console.error('Project Gutenberg search failed:', error);
    }
    
    // Apply fuzzy matching to improve results
    const fuzzyFiltered = applyFuzzyMatching(links, query);
    
    return fuzzyFiltered;
}

async function searchInternetArchive(query, bookInfo = null) {
    const links = [];
    const author = bookInfo?.author || '';
    const variations = generateQueryVariations(query, author);
    
    // Prioritize PDF-specific searches
    const pdfVariations = variations.filter(v => v.includes('.pdf') || v.includes('pdf') || v.includes('filetype:pdf'));
    const regularVariations = variations.filter(v => !v.includes('.pdf') && !v.includes('pdf') && !v.includes('filetype:pdf'));
    
    // Try PDF-focused queries first
    const prioritizedVariations = [...pdfVariations, ...regularVariations];
    
    // Build OR query for Internet Archive with PDF priority
    const orQueries = prioritizedVariations.map(v => {
        if (v.includes('filetype:pdf')) {
            return `title:(${encodeURIComponent(v.replace(' filetype:pdf', ''))}) AND format:pdf`;
        }
        return `title:(${encodeURIComponent(v)})`;
    }).join(' OR ');
    
    const searchUrl = `https://archive.org/advancedsearch.php?q=(${orQueries}) AND mediatype:texts&fl=identifier,title,creator&rows=8&output=json`;
    
    try {
        const response = await fetch(searchUrl);
        if (!response.ok) throw new Error('IA API error');
        
        const data = await response.json();
        const docs = data.response?.docs || [];
        
        for (const doc of docs) {
            const itemId = doc.identifier;
            const title = doc.title || 'Unknown Title';
            
            // Get PDF files for this item
            const pdfFiles = await getIAPDFFiles(itemId);
            
            for (const pdf of pdfFiles) {
                links.push({
                    title: `${title} - ${pdf.name}`,
                    url: pdf.url,
                    source: 'Internet Archive',
                    size: pdf.size,
                    type: 'Direct PDF Download',
                    author: doc.creator || 'Unknown',
                    relevanceScore: calculateRelevance(title, query)
                });
            }
            
            // Add streaming link
            links.push({
                title: `${title} - Online Reader`,
                url: `https://archive.org/details/${itemId}`,
                source: 'Internet Archive',
                size: 'Online',
                type: 'Read Online',
                author: doc.creator || 'Unknown',
                relevanceScore: calculateRelevance(title, query)
            });
        }
    } catch (error) {
        console.error('IA search error:', error);
    }
    
    return links;
}

async function getIAPDFFiles(itemId) {
    const pdfFiles = [];
    try {
        const response = await fetch(`https://archive.org/metadata/${itemId}`);
        if (!response.ok) return pdfFiles;
        
        const data = await response.json();
        const files = data.files || [];
        
        for (const file of files) {
            if (file.format && file.format.toLowerCase() === 'pdf') {
                pdfFiles.push({
                    name: file.name || 'document.pdf',
                    url: `https://archive.org/download/${itemId}/${file.name}`,
                    size: formatFileSize(file.size)
                });
            }
        }
    } catch (error) {
        console.error('Error getting IA PDF files:', error);
    }
    
    return pdfFiles;
}

async function searchOpenLibrary(query) {
    const links = [];
    const variations = generateQueryVariations(query);
    
    try {
        // Try each variation until we get good results
        for (const variant of variations) {
            const encodedQuery = encodeURIComponent(variant);
            const response = await fetch(`https://openlibrary.org/search.json?title=${encodedQuery}&limit=5`);
            if (!response.ok) continue;
            
            const data = await response.json();
            const docs = data.docs || [];
            
            for (const doc of docs) {
                if (doc.has_fulltext || doc.ia) {
                    const title = doc.title || 'Unknown Title';
                    const author = doc.author_name ? doc.author_name.join(', ') : 'Unknown';
                    const key = doc.key || '';
                    
                    links.push({
                        title: `${title} - Open Library`,
                        url: `https://openlibrary.org${key}`,
                        source: 'Open Library',
                        size: 'Online',
                        type: 'Read Online',
                        author: author,
                        relevanceScore: calculateRelevance(title, query)
                    });
                }
            }
            
            if (links.length >= 3) break; // Found enough results
        }
    } catch (error) {
        console.error('Open Library search error:', error);
    }
    
    return links;
}

async function searchProjectGutenberg(query) {
    const links = [];
    const variations = generateQueryVariations(query);
    
    try {
        for (const variant of variations) {
            const encodedQuery = encodeURIComponent(variant);
            const response = await fetch(`https://gutendex.com/books/?search=${encodedQuery}`);
            if (!response.ok) continue;
            
            const data = await response.json();
            const books = data.results || [];
            
            for (const book of books.slice(0, 5)) {
                const title = book.title || 'Unknown Title';
                const author = book.authors.map(a => a.name).join(', ') || 'Unknown';
                const formats = book.formats || {};
                
                // Add different format links
                if (formats['application/pdf']) {
                    links.push({
                        title: `${title} - PDF`,
                        url: formats['application/pdf'],
                        source: 'Project Gutenberg',
                        size: 'Unknown',
                        type: 'Direct PDF Download',
                        author: author,
                        relevanceScore: calculateRelevance(title, query)
                    });
                }
                
                if (formats['application/epub+zip']) {
                    links.push({
                        title: `${title} - EPUB`,
                        url: formats['application/epub+zip'],
                        source: 'Project Gutenberg',
                        size: 'Unknown',
                        type: 'Direct EPUB Download',
                        author: author,
                        relevanceScore: calculateRelevance(title, query)
                    });
                }
                
                if (formats['text/html']) {
                    links.push({
                        title: `${title} - Read Online`,
                        url: formats['text/html'],
                        source: 'Project Gutenberg',
                        size: 'Online',
                        type: 'Read Online',
                        author: author,
                        relevanceScore: calculateRelevance(title, query)
                    });
                }
            }
            
            if (links.length >= 5) break;
        }
    } catch (error) {
        console.error('Project Gutenberg search error:', error);
    }
    
    return links;
}

function calculateRelevance(title, query) {
    const normalizedTitle = normalizeQuery(title);
    const normalizedQuery = normalizeQuery(query);
    
    if (normalizedTitle === normalizedQuery) return 100;
    if (normalizedTitle.includes(normalizedQuery)) return 80;
    
    const titleWords = normalizedTitle.split(' ');
    const queryWords = normalizedQuery.split(' ');
    const matches = queryWords.filter(word => titleWords.includes(word)).length;
    
    return (matches / queryWords.length) * 60;
}

function applyFuzzyMatching(links, query) {
    if (!window.Fuse || links.length === 0) return links;
    
    const fuse = new Fuse(links, {
        keys: ['title', 'author'],
        threshold: 0.4,
        includeScore: true
    });
    
    const fuzzyResults = fuse.search(query);
    const fuzzyFiltered = fuzzyResults.map(result => ({
        ...result.item,
        fuzzyScore: (1 - result.score) * 100
    }));
    
    // Combine fuzzy and relevance scores
    const scored = fuzzyFiltered.map(link => ({
        ...link,
        combinedScore: (link.relevanceScore || 0) * 0.6 + (link.fuzzyScore || 0) * 0.4
    }));
    
    // Sort by combined score and return top results
    return scored
        .sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0))
        .slice(0, 15);
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 'Unknown') return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function displayResults(bookInfo, downloadLinks) {
    // Display download links
    const downloadLinksContainer = document.getElementById('downloadLinks');
    const resultCountElement = document.getElementById('resultCount');
    const bookInfoSection = document.getElementById('bookInfo');
    const bookDetails = document.getElementById('bookDetails');
    
    // Make sure loading animations are stopped regardless of results
    showLoading(false);
    stopBackgroundLoading();
    
    if (downloadLinks.length === 0) {
        // For no results, hide the book information section completely
        bookInfoSection.style.display = 'none';
        
        resultCountElement.textContent = '(No results)';
        
        // Dispatch event for analytics to track the failed search
        document.dispatchEvent(new CustomEvent('noBookResults', { 
            detail: { query: bookInfo.title } 
        }));
        
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
            "Quality knowledge doesn’t always come free.",
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
        // If we have results, show the book information section
        bookInfoSection.style.display = 'block';
        
        // Display book information
        bookDetails.innerHTML = `
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
                ${bookInfo.language}
            </div>
            <div class="book-detail">
                <strong>Publisher</strong>
                ${bookInfo.publisher}
            </div>
            <div class="book-detail">
                <strong>Subjects</strong>
                ${bookInfo.subjects}
            </div>
        `;
        
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
        `}).join('');
    }
    
    document.getElementById('results').style.display = 'block';
    
    // Hide default placeholder when results are displayed
    const defaultPlaceholder = document.getElementById('defaultPlaceholder');
    if (defaultPlaceholder) {
        defaultPlaceholder.style.display = 'none';
    }
    
    // Show contextual footer when results are displayed
    const contextualFooter = document.getElementById('contextualFooter');
    if (contextualFooter) {
        contextualFooter.classList.add('show');
    }
    
    // Re-initialize icons for dynamically added content
    setTimeout(() => {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }, 100);
}

function openLink(url) {
    window.open(url, '_blank');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Link copied to clipboard!');
    }).catch(err => {
        console.error('Could not copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Link copied to clipboard!');
    });
}

function showLoading(show) {
    const loadingElement = document.getElementById('loading');
    loadingElement.style.display = show ? 'block' : 'none';
    
    if (show) {
        // Clear any previous interval if present
        const existing = loadingElement.getAttribute('data-interval');
        if (existing) {
            clearInterval(parseInt(existing));
            loadingElement.removeAttribute('data-interval');
        }
        currentStepIndex = 0;
        updateLoadingStep();
        // Update loading steps every 1000ms
        const stepInterval = setInterval(() => {
            currentStepIndex = (currentStepIndex + 1) % loadingSteps.length;
            updateLoadingStep();
        }, 1000);
        
        // Store interval reference to clear it later
        loadingElement.setAttribute('data-interval', stepInterval);
    } else {
        // Clear the interval when hiding loading
        const interval = loadingElement.getAttribute('data-interval');
        if (interval) {
            clearInterval(parseInt(interval));
            loadingElement.removeAttribute('data-interval');
        }
    }
}

function updateLoadingStep() {
    const stepsElement = document.getElementById('loadingSteps');
    if (stepsElement) {
        stepsElement.textContent = loadingSteps[currentStepIndex];
    }
}

function showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<div class="error-message">${message}</div>`;
    resultsDiv.style.display = 'block';
    
    // Hide default placeholder when showing error
    const defaultPlaceholder = document.getElementById('defaultPlaceholder');
    if (defaultPlaceholder) {
        defaultPlaceholder.style.display = 'none';
    }
    
    // Make sure all loading animations are stopped
    showLoading(false);
    stopBackgroundLoading();
}

function clearResults(clearInput = true) {
    if (clearInput) {
        document.getElementById('bookSearch').value = '';
    }
    document.getElementById('results').style.display = 'none';
    
    // Show default placeholder when results are cleared
    const defaultPlaceholder = document.getElementById('defaultPlaceholder');
    if (defaultPlaceholder) {
        defaultPlaceholder.style.display = 'block';
    }
    
    // Hide contextual footer when results are cleared
    const contextualFooter = document.getElementById('contextualFooter');
    if (contextualFooter) {
        contextualFooter.classList.remove('show');
    }
    
    // Properly stop and hide loading UI
    showLoading(false);
    // Stop background loading too
    stopBackgroundLoading();
    // Remove any partial results
    const partial = document.querySelector('.results-partial');
    if (partial) partial.remove();
}
