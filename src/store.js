import { writable } from 'svelte/store';

export const graphViewConfigStore = writable({});
export const embeddingViewConfigStore = writable({});
export const tableViewConfigStore = writable({});
export const instanceViewConfigStore = writable({});
export const svgStore = writable(undefined);