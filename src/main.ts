import '@fontsource-variable/inter';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { pwa } from './lib/pwa/update.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('#app not found');

export default mount(App, { target });
pwa.start();
