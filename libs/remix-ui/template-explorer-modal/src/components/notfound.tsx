import React from 'react'

export function NotFound() {
  return (
    <section className="flex flex-col items-center justify-center">
      <img src={'assets/img/remixLogo.webp'} alt="Not Found" style={{ width: '80px', height: '80px' }} />
      <p className="text-lg">No results found</p>
      <p className="text-base">Please try again with a different search criteria or choose from our template library</p>
    </section>
  )
}
