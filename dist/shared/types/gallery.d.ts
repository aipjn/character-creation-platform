import { CharacterDisplayData, CharacterFilters, CharacterSortOptions, CharacterActions } from './character';
export type GalleryView = 'grid' | 'list';
export interface GalleryGridConfig {
    columns: number;
    gap: number;
    minCardWidth: number;
    maxCardWidth: number;
    aspectRatio: number;
}
export interface GalleryListConfig {
    itemHeight: number;
    spacing: number;
    showMetadata: boolean;
    showDescription: boolean;
}
export interface GalleryState {
    characters: CharacterDisplayData[];
    loading: boolean;
    error?: string;
    view: GalleryView;
    filters: CharacterFilters;
    sort: CharacterSortOptions;
    selectedCharacters: string[];
    totalCount: number;
    hasMore: boolean;
    page: number;
    pageSize: number;
}
export interface GalleryConfig {
    defaultView: GalleryView;
    enableFilters: boolean;
    enableSearch: boolean;
    enableSorting: boolean;
    enableBulkActions: boolean;
    enablePagination: boolean;
    pageSize: number;
    gridConfig: GalleryGridConfig;
    listConfig: GalleryListConfig;
}
export interface GalleryActions extends CharacterActions {
    onViewChange: (view: GalleryView) => void;
    onFilterChange: (filters: Partial<CharacterFilters>) => void;
    onSortChange: (sort: CharacterSortOptions) => void;
    onSearch: (query: string) => void;
    onLoadMore: () => void;
    onRefresh: () => void;
    onBulkAction: (action: string, characterIds: string[]) => void;
    onSelectionChange: (selectedIds: string[]) => void;
}
export interface CharacterCardProps {
    character: CharacterDisplayData;
    view: GalleryView;
    selected?: boolean;
    selectable?: boolean;
    actions?: CharacterActions;
    showAuthor?: boolean;
    showMetadata?: boolean;
    showTags?: boolean;
    showStatus?: boolean;
    compact?: boolean;
    onClick?: (character: CharacterDisplayData) => void;
    onSelect?: (characterId: string, selected: boolean) => void;
}
export interface GalleryBreakpoints {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
}
export interface GalleryTheme {
    colors: {
        background: string;
        cardBackground: string;
        border: string;
        text: string;
        textSecondary: string;
        accent: string;
        error: string;
        success: string;
    };
    spacing: {
        xs: number;
        sm: number;
        md: number;
        lg: number;
        xl: number;
    };
    borderRadius: {
        sm: number;
        md: number;
        lg: number;
    };
    shadows: {
        card: string;
        hover: string;
    };
    breakpoints: GalleryBreakpoints;
}
export interface SearchOptions {
    placeholder?: string;
    debounceMs?: number;
    minLength?: number;
    showClearButton?: boolean;
}
export interface FilterOptions {
    showStyleFilter?: boolean;
    showTagFilter?: boolean;
    showStatusFilter?: boolean;
    showDateFilter?: boolean;
    showVisibilityFilter?: boolean;
    availableTags?: string[];
}
export interface PaginationOptions {
    type: 'infinite' | 'numbered' | 'loadmore';
    pageSize: number;
    showTotal?: boolean;
    showPageInfo?: boolean;
}
export interface GalleryContextData {
    state: GalleryState;
    config: GalleryConfig;
    theme: GalleryTheme;
    actions: GalleryActions;
}
//# sourceMappingURL=gallery.d.ts.map