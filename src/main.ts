import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { setupAutoUpdate } from './lib/update.svelte';

const app = mount(App, {
  target: document.getElementById('app')!
});

setupAutoUpdate();

export default app;
