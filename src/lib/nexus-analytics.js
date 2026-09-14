import { supabase } from './supabase';

/**
 * Universeller NeXus GA4 & Supabase Event Tracker
 */
export function trackNexusEvent(eventName, params = {}) {
  try {
    // 1. Send to Google Analytics 4 (GA4)
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, {
        send_to: 'G-47T32Z43L2',
        ...params
      });
    }

    // 2. Also record in Supabase events table for internal dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id || null;
      supabase.from('events').insert([{
        event_name: eventName,
        user_id: userId,
        metadata: params,
        page_url: typeof window !== 'undefined' ? window.location.href : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
      }]).then(({ error }) => {
        if (error) console.debug('[Analytics] Supabase log error:', error.message);
      });
    }).catch(() => {});
  } catch (e) {
    console.debug('[Analytics] Event tracking error:', e.message);
  }
}

/**
 * Tracks Virtual Page Views in SPA for GA4
 */
export function trackNexusPageView(path, title = '') {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: path,
        page_title: title || document.title,
        page_location: window.location.href
      });
    }
  } catch (e) {
    console.debug('[Analytics] PageView error:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Pre-defined NeXus Business Conversion Trackers
// ---------------------------------------------------------------------------

export const trackOfferingAnalyzed = (offeringName, targetGroup) => {
  trackNexusEvent('nexus_offering_analyzed', {
    offering_name: offeringName,
    target_group: targetGroup
  });
};

export const trackRadarScan = (branche, hitsCount, isAuto = false) => {
  trackNexusEvent('nexus_radar_scan', {
    industry: branche,
    hits_count: hitsCount,
    scan_type: isAuto ? 'auto' : 'manual'
  });
};

export const trackPitchGenerated = (mode, companyName) => {
  trackNexusEvent('nexus_pitch_generated', {
    mode,
    company_name: companyName
  });
};

export const trackSocialOutreachGenerated = (platform, companyName, postLanguage) => {
  trackNexusEvent('nexus_social_outreach_generated', {
    platform,
    company_name: companyName,
    post_language: postLanguage
  });
};

export const trackSocialCommentCopied = (platform, companyName) => {
  trackNexusEvent('nexus_social_comment_copied', {
    platform,
    company_name: companyName
  });
};

export const trackSocialDmCopied = (platform, companyName) => {
  trackNexusEvent('nexus_social_dm_copied', {
    platform,
    company_name: companyName
  });
};

export const trackSocialOriginalOpened = (platform, url) => {
  trackNexusEvent('nexus_social_original_opened', {
    platform,
    target_url: url
  });
};

export const trackContactResearched = (companyName, role) => {
  trackNexusEvent('nexus_contact_researched', {
    company_name: companyName,
    decision_maker_role: role
  });
};

export const trackUpgradeClick = (plan, source) => {
  trackNexusEvent('nexus_upgrade_click', {
    plan_name: plan,
    source_location: source
  });
};
