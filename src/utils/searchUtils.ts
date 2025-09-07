import { CharacterDisplayData } from '../types/character';

// Search scoring weights
const SEARCH_WEIGHTS = {
  name: 10,        // Character name has highest priority
  prompt: 5,       // Prompt text is very important
  tags: 8,         // Tags are highly relevant
  styleType: 3,    // Style type is moderately relevant
  authorName: 2,   // Author name has lower priority
} as const;

// Search configuration
const SEARCH_CONFIG = {
  minScore: 0.1,           // Minimum score to include in results
  fuzzyThreshold: 0.8,     // Threshold for fuzzy matching
  maxResults: 1000,        // Maximum number of results to return
  highlightClass: 'search-highlight',  // CSS class for highlighting
} as const;

export interface SearchScore {
  character: CharacterDisplayData;
  score: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  field: keyof typeof SEARCH_WEIGHTS;
  value: string;
  score: number;
  indices: [number, number][];
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1,     // insertion
          matrix[i - 1]![j]! + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Calculate fuzzy match score between query and text
 */
function calculateFuzzyScore(query: string, text: string): number {
  if (query === text) return 1;
  if (text.length === 0) return 0;

  const distance = levenshteinDistance(query.toLowerCase(), text.toLowerCase());
  const maxLength = Math.max(query.length, text.length);
  
  return 1 - (distance / maxLength);
}

/**
 * Find all occurrences of query in text (case insensitive)
 */
function findMatches(query: string, text: string): [number, number][] {
  const matches: [number, number][] = [];
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  
  let index = 0;
  while (index < lowerText.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, index);
    if (matchIndex === -1) break;
    
    matches.push([matchIndex, matchIndex + query.length]);
    index = matchIndex + 1;
  }
  
  return matches;
}

/**
 * Calculate match score for a specific field
 */
function calculateFieldScore(
  query: string, 
  text: string, 
  field: keyof typeof SEARCH_WEIGHTS
): SearchMatch | null {
  if (!text || !query.trim()) {
    return null;
  }

  const cleanQuery = query.trim().toLowerCase();
  const cleanText = text.toLowerCase();
  
  // Exact match (highest score)
  if (cleanText === cleanQuery) {
    return {
      field,
      value: text,
      score: 1.0,
      indices: [[0, text.length]],
    };
  }
  
  // Contains exact query
  if (cleanText.includes(cleanQuery)) {
    const matches = findMatches(query, text);
    const score = 0.8 + (0.2 * (cleanQuery.length / cleanText.length));
    
    return {
      field,
      value: text,
      score: Math.min(score, 1.0),
      indices: matches,
    };
  }
  
  // Word boundary matches (higher score for word beginnings)
  const words = cleanText.split(/\s+/);
  const queryWords = cleanQuery.split(/\s+/);
  let wordMatchScore = 0;
  let wordMatches: [number, number][] = [];
  
  for (const queryWord of queryWords) {
    for (const word of words) {
      if (word.startsWith(queryWord)) {
        wordMatchScore += 0.6;
        const wordIndex = cleanText.indexOf(word);
        if (wordIndex !== -1) {
          wordMatches.push([wordIndex, wordIndex + queryWord.length]);
        }
      } else if (word.includes(queryWord)) {
        wordMatchScore += 0.4;
        const wordIndex = cleanText.indexOf(queryWord);
        if (wordIndex !== -1) {
          wordMatches.push([wordIndex, wordIndex + queryWord.length]);
        }
      }
    }
  }
  
  if (wordMatchScore > 0) {
    return {
      field,
      value: text,
      score: Math.min(wordMatchScore / queryWords.length, 0.9),
      indices: wordMatches,
    };
  }
  
  // Fuzzy matching as fallback
  const fuzzyScore = calculateFuzzyScore(cleanQuery, cleanText);
  if (fuzzyScore >= SEARCH_CONFIG.fuzzyThreshold) {
    return {
      field,
      value: text,
      score: fuzzyScore * 0.5, // Lower score for fuzzy matches
      indices: [],
    };
  }
  
  return null;
}

/**
 * Search through character tags
 */
function searchTags(query: string, tags: string[]): SearchMatch | null {
  if (tags.length === 0) return null;
  
  const cleanQuery = query.trim().toLowerCase();
  let bestMatch: SearchMatch | null = null;
  let bestScore = 0;
  
  for (const tag of tags) {
    const match = calculateFieldScore(query, tag, 'tags');
    if (match && match.score > bestScore) {
      bestScore = match.score;
      bestMatch = match;
    }
    
    // Exact tag match gets bonus score
    if (tag.toLowerCase() === cleanQuery) {
      bestMatch = {
        field: 'tags',
        value: tag,
        score: 1.0,
        indices: [[0, tag.length]],
      };
      break;
    }
  }
  
  return bestMatch;
}

/**
 * Calculate overall character score
 */
function calculateCharacterScore(character: CharacterDisplayData, query: string): SearchScore | null {
  const matches: SearchMatch[] = [];
  let totalScore = 0;
  
  // Search in character name
  if (character.name) {
    const nameMatch = calculateFieldScore(query, character.name, 'name');
    if (nameMatch) {
      matches.push(nameMatch);
      totalScore += nameMatch.score * SEARCH_WEIGHTS.name;
    }
  }
  
  // Search in prompt
  if (character.prompt) {
    const promptMatch = calculateFieldScore(query, character.prompt, 'prompt');
    if (promptMatch) {
      matches.push(promptMatch);
      totalScore += promptMatch.score * SEARCH_WEIGHTS.prompt;
    }
  }
  
  // Search in tags
  const tagMatch = searchTags(query, character.tags);
  if (tagMatch) {
    matches.push(tagMatch);
    totalScore += tagMatch.score * SEARCH_WEIGHTS.tags;
  }
  
  // Search in style type
  if (character.styleType) {
    const styleMatch = calculateFieldScore(query, character.styleType, 'styleType');
    if (styleMatch) {
      matches.push(styleMatch);
      totalScore += styleMatch.score * SEARCH_WEIGHTS.styleType;
    }
  }
  
  // Search in author name
  if (character.author?.name) {
    const authorMatch = calculateFieldScore(query, character.author.name, 'authorName');
    if (authorMatch) {
      matches.push(authorMatch);
      totalScore += authorMatch.score * SEARCH_WEIGHTS.authorName;
    }
  }
  
  // Calculate normalized score
  const maxPossibleScore = Object.values(SEARCH_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const normalizedScore = totalScore / maxPossibleScore;
  
  // Only return if score meets minimum threshold
  if (normalizedScore >= SEARCH_CONFIG.minScore && matches.length > 0) {
    return {
      character,
      score: normalizedScore,
      matches,
    };
  }
  
  return null;
}

/**
 * Main search function - optimized for large collections
 */
export function searchCharacters(
  characters: CharacterDisplayData[], 
  query: string,
  options?: {
    maxResults?: number;
    minScore?: number;
  }
): SearchScore[] {
  if (!query.trim() || characters.length === 0) {
    return [];
  }
  
  const maxResults = options?.maxResults ?? SEARCH_CONFIG.maxResults;
  const minScore = options?.minScore ?? SEARCH_CONFIG.minScore;
  
  const results: SearchScore[] = [];
  
  // Use a priority queue approach for large datasets
  let lowestScore = 0;
  
  for (const character of characters) {
    const searchScore = calculateCharacterScore(character, query);
    
    if (!searchScore || searchScore.score < minScore) {
      continue;
    }
    
    // If we haven't reached max results, add the result
    if (results.length < maxResults) {
      results.push(searchScore);
      
      // Sort to maintain order and update lowest score
      if (results.length === maxResults) {
        results.sort((a, b) => b.score - a.score);
        lowestScore = results[results.length - 1]!.score;
      }
    } else if (searchScore.score > lowestScore) {
      // Replace the lowest score result
      results[results.length - 1] = searchScore;
      results.sort((a, b) => b.score - a.score);
      lowestScore = results[results.length - 1]!.score;
    }
  }
  
  // Final sort if we have fewer than maxResults
  if (results.length < maxResults) {
    results.sort((a, b) => b.score - a.score);
  }
  
  return results;
}

/**
 * Highlight search terms in text
 */
export function highlightSearchTerms(
  text: string, 
  indices: [number, number][], 
  className: string = SEARCH_CONFIG.highlightClass
): string {
  if (!indices.length) {
    return text;
  }
  
  // Sort indices by start position
  const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);
  
  let result = '';
  let lastIndex = 0;
  
  for (const [start, end] of sortedIndices) {
    // Add text before highlight
    result += text.slice(lastIndex, start);
    
    // Add highlighted text
    result += `<span class="${className}">${text.slice(start, end)}</span>`;
    
    lastIndex = end;
  }
  
  // Add remaining text
  result += text.slice(lastIndex);
  
  return result;
}

/**
 * Extract search suggestions based on available characters
 */
export function generateSearchSuggestions(
  characters: CharacterDisplayData[],
  query: string = '',
  limit: number = 10
): string[] {
  const lowerQuery = query.toLowerCase().trim();
  
  // Collect all possible search terms
  const terms = new Set<string>();
  
  characters.forEach(character => {
    // Add character names
    if (character.name) {
      terms.add(character.name.toLowerCase());
    }
    
    // Add tags
    character.tags.forEach(tag => {
      terms.add(tag.toLowerCase());
    });
    
    // Add style types
    terms.add(character.styleType.toLowerCase());
    
    // Add author names
    if (character.author?.name) {
      terms.add(character.author.name.toLowerCase());
    }
    
    // Add significant words from prompts
    if (character.prompt) {
      const words = character.prompt
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3); // Only include significant words
      
      words.forEach(word => terms.add(word));
    }
  });
  
  // Filter and score suggestions
  const scoredSuggestions = Array.from(terms)
    .filter(term => {
      if (!lowerQuery) return true;
      return term.includes(lowerQuery) || lowerQuery.includes(term);
    })
    .map(term => ({
      term,
      score: calculateFuzzyScore(lowerQuery, term),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.term);
  
  return scoredSuggestions;
}