
const loadingSteps = [
    '� Warming up the search engines...',
    '� Consulting the digital librarians...',
    '🤖 Teaching algorithms what books are...',
    '� Sending carrier pigeons to servers...',
    '🎯 Locating your needle in the haystack...',
    '🧠 Running fuzzy logic through coffee filters...',
    '📖 Asking books nicely to reveal themselves...',
    '� Predicting your reading preferences...',
    '� Launching quantum book detectors...',
    '� Having philosophical discussions with PDFs...'
];

const backgroundLoadingSteps = [
    '🏗️ Building better results in the background...',
    '⚡ Supercharging search algorithms...',
    '🎨 Polishing the good stuff...',
    '� Running advanced book forensics...',
    '🎪 Teaching PDFs new tricks...',
    '� Hunting for premium content...',
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

function generateQueryVariations(originalQuery) {
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
        }
    }
    
    // Remove duplicates and empty strings
    return [...new Set(variations)].filter(v => v.length > 0);
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
            showLoading(false);
        }
        
        // Phase 2: Background loading of better sources
        startBackgroundLoading();
        
        const backgroundPromises = [
            searchInternetArchive(query),
            searchProjectGutenberg(query)
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
        showError('Search failed: ' + error.message);
        showLoading(false);
        stopBackgroundLoading();
    }
}

function startBackgroundLoading() {
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
                return {
                    title: book.title || query,
                    author: book.author_name ? book.author_name.join(', ') : 'Unknown Author',
                    firstPublished: book.first_publish_year || 'Unknown',
                    subjects: book.subject ? book.subject.slice(0, 5).join(', ') : 'Not specified',
                    language: book.language ? book.language.slice(0, 3).join(', ') : 'Not specified',
                    publisher: book.publisher && book.publisher.length > 0 ? 
                        book.publisher.slice(0, 2)
                            .filter(p => p && p.toLowerCase() !== 'specified' && p.toLowerCase() !== 'not specified' && p.trim() !== '')
                            .join(', ') || 'Unknown' : 'Unknown'
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

async function searchDownloadLinks(query) {
    const links = [];
    
    // Search Internet Archive with smart queries
    try {
        const iaLinks = await searchInternetArchive(query);
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
        const pgLinks = await searchProjectGutenberg(query);
        links.push(...pgLinks);
    } catch (error) {
        console.error('Project Gutenberg search failed:', error);
    }
    
    // Apply fuzzy matching to improve results
    const fuzzyFiltered = applyFuzzyMatching(links, query);
    
    return fuzzyFiltered;
}

async function searchInternetArchive(query) {
    const links = [];
    const variations = generateQueryVariations(query);
    
    // Build OR query for Internet Archive
    const orQueries = variations.map(v => `title:(${encodeURIComponent(v)})`).join(' OR ');
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
    // Display book information
    const bookDetails = document.getElementById('bookDetails');
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
    
    // Display download links
    const downloadLinksContainer = document.getElementById('downloadLinks');
    const resultCountElement = document.getElementById('resultCount');
    
    if (downloadLinks.length === 0) {
        resultCountElement.textContent = '(No results)';
        downloadLinksContainer.innerHTML = `
            <div class="no-results">
                <i data-lucide="frown" style="width: 48px; height: 48px; margin-bottom: 15px; color: #6c757d;"></i>
                <h3>No direct download links found</h3>
                <p>Try searching with different keywords or check back later.</p>
            </div>
        `;
    } else {
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
    
    // stop and hide loading UI
    showLoading(false);
    // Stop background loading too
    stopBackgroundLoading();
    // Remove any partial results
    const partial = document.querySelector('.results-partial');
    if (partial) partial.remove();
}
