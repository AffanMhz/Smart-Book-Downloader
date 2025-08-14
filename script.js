// Loading steps with messages
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

function generateQueryVariations(originalQuery, author = '', fullVariations = false) {
    const normalized = normalizeQuery(originalQuery);
    
    // Core variations - always include these critical ones
    const variations = [
        originalQuery, // Exact as typed
        normalized     // Normalized
    ];
    
    // Split on common subtitle separators (only main title is most important)
    if (normalized.includes(':')) {
        variations.push(normalized.split(':')[0].trim());
    }
    else if (normalized.includes(' - ')) { // Changed to else if to reduce variations
        variations.push(normalized.split(' - ')[0].trim());
    }
    
    // PDF is the most important variation for finding downloadable content
    variations.push(`${normalized} pdf`);
    
    // Only include extended variations when fullVariations is true
    // or when author information is high quality
    if (fullVariations) {
        // Add stopword removal variation
        variations.push(removeStopwords(normalized));
        
        // Try to detect "Title, Author" pattern
        if (normalized.includes(',')) {
            const parts = normalized.split(',');
            if (parts.length === 2) {
                variations.push(parts[0].trim()); // Just title
                // Only add one of the author variations to reduce duplicates
                variations.push(`${parts[0].trim()} ${parts[1].trim()}`); // Title + Author
            }
        }
        
        // Add author-enhanced variations if provided and looks legitimate
        if (author && author.toLowerCase() !== 'unknown author' && author.toLowerCase() !== 'unknown') {
            const cleanAuthor = author.replace(/,.*$/, '').trim(); // Remove everything after first comma
            variations.push(`${normalized} ${cleanAuthor}`);
            
            // Only add one PDF variation with author
            if (cleanAuthor.length > 3) { // Only if author name seems valid
                variations.push(`${normalized} ${cleanAuthor} filetype:pdf`);
            }
        }
        
        // Add additional PDF variations only in full mode
        variations.push(`${normalized}.pdf`);
        variations.push(`"${normalized}.pdf"`);
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

// Track if an error animation is currently active
let errorAnimationActive = false;

// Main search function with progressive loading
async function searchBook() {
    const searchInput = document.getElementById('bookSearch');
    const query = searchInput.value.trim();
    
    // Return early if query is empty or just whitespace
    if (!query || query.length < 1) {
        // Prevent multiple animations if already showing error
        if (errorAnimationActive) return;
        
        errorAnimationActive = true;
        
        // Show a brief message for empty searches
        searchInput.classList.add('search-error');
        searchInput.placeholder = "Please enter a book title to search";
        searchInput.focus(); // Focus on the input for better UX
        
        // Reset the placeholder after a few seconds
        setTimeout(() => {
            searchInput.classList.remove('search-error');
            searchInput.placeholder = "Enter book title (e.g., 'Pride and Prejudice', '1984', 'Python Programming')";
            errorAnimationActive = false;
        }, 2000);
        
        return;
    }
    
    // Keep the default placeholder showing until we have data
    document.getElementById('results').style.display = 'none'; // Initially hide results container
    document.getElementById('downloadLinks').innerHTML = '';
    document.getElementById('resultCount').textContent = '';
    
    // Show loading state
    showLoading(true);
    
    try {
        // Start both searches in parallel for better performance
        const bookInfoPromise = getBookInfo(query);
        const downloadLinksPromise = searchDownloadLinks(query, null); // Initially start without bookInfo
        
        // Wait for the book info first (should be faster)
        const bookInfo = await bookInfoPromise;
        
        // Show book info as soon as it's available
        if (!bookInfo.isDefaultInfo) {
            displayBookInfo(bookInfo);
        }
        
        // Get download links (should be ready or nearly ready by now)
        const downloadLinks = await downloadLinksPromise;
        
        // Prioritize PDF results to the top
        const prioritizedLinks = downloadLinks.sort((a, b) => {
            // First priority: Direct PDF downloads
            if (a.type && b.type) {
                if (a.type.includes('PDF') && !b.type.includes('PDF')) return -1;
                if (!a.type.includes('PDF') && b.type.includes('PDF')) return 1;
            }
            
            // Second priority: Higher relevance score
            return (b.relevanceScore || 0) - (a.relevanceScore || 0);
        });
        
        // Only display book info if we either have real book info or we found download links
        if (!bookInfo.isDefaultInfo || downloadLinks.length > 0) {
            // If we haven't already displayed book info, do it now
            if (bookInfo.isDefaultInfo) {
                displayBookInfo(bookInfo);
            }
            
            // Display download links (even if none were found, it will show purchase options)
            displayDownloadLinks(bookInfo, prioritizedLinks);
        } else {
            // No real book info and no download links found - this is likely a fake or very obscure book
            // Show a more appropriate message
            showNoBookFoundMessage(query);
        }
        
        // Update contextual footer visibility
        document.getElementById('contextualFooter').style.display = 'block';
        
    } catch (error) {
        console.error('Search error:', error);
        showLoading(false);
        stopBackgroundLoading();
        document.getElementById('downloadLinks').innerHTML = `
            <div class="error-message">
                <p>Sorry, an error occurred during your search. Please try again later.</p>
            </div>
        `;
    }
}

function startBackgroundLoading() {
    // Don't start background loading if main loading is still active
    if (document.getElementById('loading').style.display === 'block') {
        return;
    }
    
    isBackgroundLoading = true;
    const loader = document.getElementById('backgroundLoader');
    
    // Ensure the loader is visible by setting display property directly
    loader.style.display = 'flex';
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
    
    // Hide the loader completely when stopping
    setTimeout(() => {
        if (!isBackgroundLoading) {
            loader.style.display = 'none';
        }
    }, 300); // Short delay for animation to complete
    
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

    // Use limited query variations first for speed
    const variations = generateQueryVariations(query, '', false);
    
    try {
        // Try each variation until we get a good match
        for (const variant of variations) {
            const encodedQuery = encodeURIComponent(variant);
            const response = await fetch(`https://openlibrary.org/search.json?title=${encodedQuery}&limit=1`);
            
            if (!response.ok) continue;
            
            const data = await response.json();
            
            if (data.docs && data.docs.length > 0) {
                const book = data.docs[0];
                
                // Enhanced language processing with all languages stored
                let languages = 'Not specified';
                let allLanguages = [];
                
                if (book.language && book.language.length > 0) {
                    // Map all language codes to their proper names
                    allLanguages = book.language.map(code => 
                        languageMap[code] || code.charAt(0).toUpperCase() + code.slice(1)
                    );
                    
                    // Display only the first three for the initial view
                    languages = allLanguages.slice(0, 3).join(', ');
                    
                    // Add indicator if there are more languages
                    if (allLanguages.length > 3) {
                        languages += ` (+${allLanguages.length - 3} more)`;
                    }
                }
                
                // Enhanced subjects processing with subject_facet support
                let subjects = 'Not specified';
                // First try subject_facet (cleaner, categorized subjects)
                if (book.subject_facet && book.subject_facet.length > 0) {
                    subjects = book.subject_facet
                        .filter(s => s && s.trim() !== '')
                        .slice(0, 5)
                        .join(', ') || 'Not specified';
                } 
                // Fall back to regular subjects if needed
                else if (book.subject && book.subject.length > 0) {
                    subjects = book.subject
                        .filter(s => s && s.trim() !== '' && s.toLowerCase() !== 'not specified')
                        .slice(0, 5)
                        .join(', ') || 'Not specified';
                }
                
                // Improved publisher processing
                let publisher = 'Unknown';
                if (book.publisher && book.publisher.length > 0) {
                    publisher = book.publisher.slice(0, 2)
                        .filter(p => p && p.trim() !== '' && 
                               p.toLowerCase() !== 'not specified' && 
                               p.toLowerCase() !== 'unknown')
                        .join(', ') || 'Unknown';
                }
                
                // Get cover image ID if available
                let coverId = null;
                if (book.cover_i) {
                    coverId = book.cover_i;
                } else if (book.cover_edition_key) {
                    coverId = `olid:${book.cover_edition_key}`;
                }
                
                return {
                    title: book.title || query,
                    author: book.author_name ? book.author_name.join(', ') : 'Unknown Author',
                    firstPublished: book.first_publish_year || 'Unknown',
                    subjects,
                    language: languages,
                    allLanguages: allLanguages,
                    publisher,
                    coverId: coverId
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
        allLanguages: [],
        publisher: 'Unknown',
        coverId: null,
        isDefaultInfo: true // Flag to identify this as default fallback info, not a real match
    };
}

async function searchDownloadLinks(query, bookInfo = null) {
    let links = [];
    
    // First try the fastest sources with limited query variations
    // Open Library tends to be the fastest
    try {
        // Use limited query variations for the first fast search
        const limitedQuery = generateQueryVariations(query, bookInfo?.author || '', false);
        const fastVariant = limitedQuery.length > 0 ? limitedQuery[0] : query;
        
        const olLinks = await searchOpenLibrary(fastVariant);
        links.push(...olLinks);
    } catch (error) {
        console.error('Open Library quick search failed:', error);
    }
    
    // Search Project Gutenberg (also typically fast)
    try {
        // Use limited query variations for the first fast search
        const limitedQuery = generateQueryVariations(query, bookInfo?.author || '', false);
        const fastVariant = limitedQuery.length > 0 ? limitedQuery[0] : query;
        
        const pgLinks = await searchProjectGutenberg(fastVariant, bookInfo);
        links.push(...pgLinks);
    } catch (error) {
        console.error('Project Gutenberg quick search failed:', error);
    }
    
    // Only search Internet Archive (typically slower) if we have fewer than 10 results
    // or if we have no PDF download links
    const hasPdfLinks = links.some(link => link.type && link.type.includes('PDF'));
    if (links.length < 10 || !hasPdfLinks) {
        try {
            // For Internet Archive, use more query variations because it has more content
            const iaLinks = await searchInternetArchive(query, bookInfo);
            links.push(...iaLinks);
        } catch (error) {
            console.error('Internet Archive search failed:', error);
        }
        
        // If still not enough results, try a more exhaustive search of Open Library and Project Gutenberg
        if (links.length < 5) {
            try {
                // Use full variations for a more exhaustive search
                const fullQuery = generateQueryVariations(query, bookInfo?.author || '', true);
                
                // Search Open Library with more variations
                const moreOlLinks = await searchOpenLibrary(query); // Use original query for more results
                links.push(...moreOlLinks);
                
                // Search Project Gutenberg with more variations
                const morePgLinks = await searchProjectGutenberg(query, bookInfo); // Use original query
                links.push(...morePgLinks);
            } catch (error) {
                console.error('Expanded search failed:', error);
            }
        }
    }
    
    // Apply fuzzy matching to improve results
    const fuzzyFiltered = applyFuzzyMatching(links, query);
    
    // Remove duplicates that might have been added from multiple searches
    const uniqueLinks = [];
    const seenUrls = new Set();
    
    for (const link of fuzzyFiltered) {
        if (link.url && !seenUrls.has(link.url)) {
            seenUrls.add(link.url);
            uniqueLinks.push(link);
        }
    }
    
    return uniqueLinks;
}

async function searchInternetArchive(query, bookInfo = null) {
    const links = [];
    const author = bookInfo?.author || '';
    // Use limited variations by default to speed up Internet Archive search
    const variations = generateQueryVariations(query, author, false);
    
    // Take only the first 3 variations to speed up search
    const limitedVariations = variations.slice(0, 3);
    
    // Prioritize PDF-specific searches
    const pdfVariations = limitedVariations.filter(v => v.includes('.pdf') || v.includes('pdf') || v.includes('filetype:pdf'));
    const regularVariations = limitedVariations.filter(v => !v.includes('.pdf') && !v.includes('pdf') && !v.includes('filetype:pdf'));
    
    // Try PDF-focused queries first, but limit to just a few variations
    const prioritizedVariations = [...pdfVariations, ...regularVariations].slice(0, 3);
    
    // Build OR query for Internet Archive with PDF priority
    const orQueries = prioritizedVariations.map(v => {
        // Direct PDF format search
        if (v.includes('filetype:pdf')) {
            return `title:(${encodeURIComponent(v.replace(' filetype:pdf', ''))}) AND format:pdf`;
        }
        // PDF extension in query - high priority
        else if (v.includes('.pdf')) {
            return `title:(${encodeURIComponent(v)}) AND format:pdf`;
        }
        // PDF keyword search - medium priority  
        else if (v.includes(' pdf')) {
            return `title:(${encodeURIComponent(v.replace(' pdf', ''))}) AND format:pdf`;
        }
        // Standard search - lower priority
        return `title:(${encodeURIComponent(v)})`;
    }).join(' OR ');
    
    // Improved URL that explicitly asks for format:pdf in mediatype:texts
    // This helps IA prioritize returning actual PDF files
    const searchUrl = `https://archive.org/advancedsearch.php?q=(${orQueries}) AND mediatype:texts&fl=identifier,title,creator,format&sort[]=downloads desc&rows=10&output=json`;
    
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
            
            // Continue searching through more variations for better results
            // Only break if we've found a significant number of results
            if (links.length >= 8) break;
        }
    } catch (error) {
        console.error('Open Library search error:', error);
    }
    
    return links;
}

async function searchProjectGutenberg(query, bookInfo = null) {
    const links = [];
    
    // Use author information if available
    let author = '';
    if (bookInfo && bookInfo.author && bookInfo.author.toLowerCase() !== 'unknown author') {
        author = bookInfo.author.split(',')[0].trim();
    }
    
    // Generate variations with author context if available
    const variations = generateQueryVariations(query, author);
    
    // Prioritize PDF variations first for faster PDF finding
    const pdfVariations = variations.filter(v => v.includes('.pdf') || v.includes(' pdf') || v.includes('filetype:pdf'));
    const regularVariations = variations.filter(v => !pdfVariations.includes(v));
    const prioritizedVariations = [...pdfVariations, ...regularVariations];
    
    try {
        for (const variant of prioritizedVariations) {
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

// Use displayBookInfo and displayDownloadLinks from progressive-display.js
function displayResults(bookInfo, downloadLinks) {
    // Simply call both display functions for backward compatibility
    displayBookInfo(bookInfo);
    displayDownloadLinks(bookInfo, downloadLinks);
}
    
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
    
    // Clear any existing timeout for the long search message
    if (window.longSearchTimeout) {
        clearTimeout(window.longSearchTimeout);
        window.longSearchTimeout = null;
    }
    
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
        
        // Set timeout for long search message (8 seconds)
        window.longSearchTimeout = setTimeout(() => {
            // Only show if we're still loading
            if (loadingElement.style.display === 'block') {
                const loadingTextElement = document.getElementById('loadingText');
                if (loadingTextElement) {
                    loadingTextElement.innerHTML = 'This is taking longer than expected.<br>Please wait a few more seconds or check your internet connection...';
                    loadingTextElement.classList.add('loading-slow');
                }
            }
        }, 8000);
    } else {
        // Clear the interval when hiding loading
        const interval = loadingElement.getAttribute('data-interval');
        if (interval) {
            clearInterval(parseInt(interval));
            loadingElement.removeAttribute('data-interval');
        }
        
        // Reset loading text when done
        const loadingTextElement = document.getElementById('loadingText');
        if (loadingTextElement) {
            loadingTextElement.textContent = 'Finding great books...';
            loadingTextElement.classList.remove('loading-slow');
        }
    }
}

function updateLoadingStep() {
    const stepsElement = document.getElementById('loadingSteps');
    if (stepsElement) {
        stepsElement.textContent = loadingSteps[currentStepIndex];
    }
}

// Function to toggle showing all languages
function toggleAllLanguages(element, allLanguages) {
    if (!allLanguages || allLanguages.length === 0) return;
    
    const currentDisplay = element.getAttribute('data-showing-all') === 'true';
    
    if (currentDisplay) {
        // Restore the short version
        element.textContent = allLanguages.slice(0, 3).join(', ');
        element.setAttribute('data-showing-all', 'false');
        element.title = "Click to see all languages";
    } else {
        // Show all languages
        element.textContent = allLanguages.join(', ');
        element.setAttribute('data-showing-all', 'true');
        element.title = "Click to show fewer languages";
    }
}

function showNoBookFoundMessage(query) {
    // Hide loading indicators
    showLoading(false);
    stopBackgroundLoading();
    
    // Hide default placeholder
    const defaultPlaceholder = document.getElementById('defaultPlaceholder');
    if (defaultPlaceholder) {
        defaultPlaceholder.style.display = 'none';
    }
    
    // Show the error message in the results container
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <div class="error-message">
            <h3>No Book Found</h3>
            <p>We couldn't find any book matching "${query}". Please check your spelling or try a different title.</p>
            <div class="error-suggestions">
                <h4>Suggestions:</h4>
                <ul>
                    <li>Check for typos in the book title</li>
                    <li>Try searching by the author's name instead</li>
                    <li>Use a more general search term</li>
                    <li>Try a different book</li>
                </ul>
            </div>
        </div>
    `;
    resultsDiv.style.display = 'block';
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
    const searchInput = document.getElementById('bookSearch');
    
    if (clearInput) {
        searchInput.value = '';
        // Also clear any error states
        searchInput.classList.remove('search-error');
        searchInput.placeholder = "Enter book title (e.g., 'Pride and Prejudice', '1984', 'Python Programming')";
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

// End of script
