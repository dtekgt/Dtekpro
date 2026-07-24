/* D-TEK GT v30 visual behavior. No data or Supabase contracts are changed. */
(() => {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function boot() {
    document.body.classList.add('v30-ready');

    const revealTargets = document.querySelectorAll([
      '.services-hero-v25', '.catalog-toolbar-v25', '.catalog-panel-v25', '.additional-catalog-v274',
      '.agenda-heading-v25', '.booking-progress-v25', '.booking-workspace-v25',
      '.garage-command-center', '.overview-layout', '.section-action-row', '.vehicles-workspace',
      '.appointment-tabs', '.appointment-tab-panel', '.points-wallet', '.points-actions-grid',
      '.profile-identity-card', '.profile-social-grid', '.public-page-hero-v24', '.faq-shell-v24',
      '.referral-hero-v24', '.referral-grid-v24', '.purchase-grid-v24', '.service-detail-layout-v24'
    ].join(','));

    revealTargets.forEach((el, index) => {
      el.classList.add('v30-reveal');
      el.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    });

    if (reduced || !('IntersectionObserver' in window)) {
      revealTargets.forEach(el => el.classList.add('v30-visible'));
    } else {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('v30-visible');
          io.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -30px' });
      revealTargets.forEach(el => io.observe(el));
    }

    const sheenTargets = document.querySelectorAll('.client-card, .booking-panel-v25, .booking-summary-v25, .selector-accordion, .public-form-card-v24, .referral-steps-v24');
    sheenTargets.forEach(el => {
      el.classList.add('v30-sheen');
      el.addEventListener('pointermove', event => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--v30-x', `${event.clientX - rect.left}px`);
        el.style.setProperty('--v30-y', `${event.clientY - rect.top}px`);
      }, { passive: true });
    });

    document.querySelectorAll('[data-open-timeline]').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelector('[data-client-section="vehicles"]')?.click();
        window.setTimeout(() => document.querySelector('[data-vehicle-tab="timeline"]')?.click(), 80);
      });
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('[data-client-section], [data-vehicle-tab], [data-appointment-tab], [data-points-list], [data-catalog-mode], [data-agenda-list-mode]')) return;
      window.setTimeout(() => {
        document.querySelectorAll('.v30-reveal').forEach(el => {
          if (el.getClientRects().length) el.classList.add('v30-visible');
        });
      }, 120);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
