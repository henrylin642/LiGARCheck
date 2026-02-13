// config.js
// IMPORTANT: Replace these with your actual Supabase project details
const SUPABASE_URL = 'https://jkuszdxkyffxtwmhpdps.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXN6ZHhreWZmeHR3bWhwZHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTUxNTcsImV4cCI6MjA4NjU5MTE1N30.MsV4Stl1dxLONxjjDsYPZvNcJMbu3r1VX8XyniYlP34';

// Initialize the Supabase client
// We use a different variable name for the global client to avoid conflict with the library 'supabase'
let supabaseClient;

if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // Also assign to 'supabase' on window for backward compatibility if scripts expect it,
    // BUT we should update our scripts to use supabaseClient to be clean.
    // For now, let's overwrite the library global with the client instance
    // so we don't have to change the other files.
    window.supabase = supabaseClient;
    console.log('Supabase client initialized');
} else {
    console.error('Supabase library not loaded. Check your internet connection or script tags.');
    alert('Supabase library not loaded!');
}
