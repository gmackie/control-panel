'use client'

export default function SimpleAuth() {
  const setAuthCookie = () => {
    // Set a simple auth cookie for testing
    document.cookie = 'auth-token=test-token-gmackie; path=/; max-age=86400; secure; samesite=lax'
    window.location.href = '/'
  }
  
  return (
    <div style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: 'white' }}>
      <div>
        <h1>GMAC.IO Control Panel</h1>
        <p>Simple Auth (Testing Only)</p>
        <button 
          onClick={setAuthCookie}
          style={{ padding: '12px 24px', fontSize: '16px', background: '#24292e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Authorize as gmackie
        </button>
      </div>
    </div>
  )
}