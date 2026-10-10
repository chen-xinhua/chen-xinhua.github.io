document.addEventListener('DOMContentLoaded', function() {
    const currentYear = document.getElementById('current-year');
    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    setupMobileMenu();
    setupSmoothScroll();
    setupNavHighlight();
    setupContactQR();
    setupContactTopics();
    setupOutreachPreview();
    makeAllLinksOpenInNewTab();
    setupLinkObserver();

    loadNews();
    loadHonors();
    loadPublications();
    setupCitationCount();
});

const isChinese = document.documentElement.lang.toLowerCase().startsWith('zh');
const uiText = (english, chinese) => isChinese ? chinese : english;

function setupCitationCount() {
    const badge = document.getElementById('citation-count');
    if (!badge) return;
    const value = badge.querySelector('[data-citation-value]');
    const refresh = async () => {
        try {
            const response = await fetch(getDataPath('citations.json'), { cache: 'no-store' });
            if (!response.ok) throw new Error('Citation data unavailable');
            const stats = await response.json();
            if (!Number.isSafeInteger(stats.totalCitations) || stats.totalCitations < 0 || !stats.updatedAt) return;
            value.textContent = stats.totalCitations.toLocaleString('en-US');
            const updated = new Date(stats.updatedAt);
            badge.title = isChinese ? `Google Scholar · 更新于 ${updated.toLocaleString('zh-CN')}` : `Google Scholar · Updated ${updated.toLocaleString()}`;
            badge.setAttribute('aria-label', isChinese ? `Google Scholar 总引用数 ${stats.totalCitations}，更新于 ${updated.toLocaleString('zh-CN')}` : `${stats.totalCitations} total citations on Google Scholar. Updated ${updated.toLocaleString()}`);
        } catch (error) {
            // Retain the last successfully displayed value during transient failures.
            console.warn('Unable to refresh citation count:', error.message);
        }
    };
    refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

function setupOutreachPreview() {
    const dialog = document.getElementById('outreach-preview-dialog');
    if (!dialog) return;
    const image = dialog.querySelector('img');
    const title = dialog.querySelector('h2');
    document.querySelectorAll('[data-outreach-image]').forEach(button => {
        button.addEventListener('click', () => {
            image.src = button.dataset.outreachImage;
            image.alt = button.dataset.outreachTitle;
            title.textContent = button.dataset.outreachTitle;
            dialog.showModal();
        });
    });
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        const bounds = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
    });
}

function setupContactQR() {
    const dialog = document.getElementById('contact-qr-dialog');
    if (!dialog) return;

    const title = document.getElementById('contact-qr-title');
    const image = document.getElementById('contact-qr-image');
    const contacts = {
        wechat: { title: '微信公众号', image: 'assets/contact/wechat-qr.jpg' },
        xiaohongshu: { title: '小红书 · 马华', image: 'assets/contact/xiaohongshu-qr.jpg' }
    };

    document.querySelectorAll('[data-contact-qr]').forEach(button => {
        button.addEventListener('click', () => {
            const contact = contacts[button.dataset.contactQr];
            title.textContent = contact.title;
            image.src = contact.image;
            image.alt = contact.title + '二维码';
            dialog.showModal();
        });
    });

    dialog.querySelector('.contact-qr-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        const bounds = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
            dialog.close();
        }
    });
}

function setupContactTopics() {
    const buttons = [...document.querySelectorAll('.contact-topic[aria-controls]')];
    if (!buttons.length) return;

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const wasExpanded = button.getAttribute('aria-expanded') === 'true';
            buttons.forEach(other => {
                other.setAttribute('aria-expanded', 'false');
                document.getElementById(other.getAttribute('aria-controls')).hidden = true;
            });
            if (!wasExpanded) {
                button.setAttribute('aria-expanded', 'true');
                document.getElementById(button.getAttribute('aria-controls')).hidden = false;
            }
        });
    });
}

function setupMobileMenu() {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (!mobileMenuBtn || !mobileMenu) {
        return;
    }

    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
        mobileMenuBtn.setAttribute('aria-expanded', String(!mobileMenu.classList.contains('hidden')));
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
        });
    });
}

function setupSmoothScroll() {
    const navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a');

    navLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            const href = this.getAttribute('href');
            if (!href || !href.startsWith('#') || href === '#') {
                return;
            }

            const target = document.querySelector(href);
            if (!target) {
                return;
            }

            event.preventDefault();
            const nav = document.querySelector('.top-nav');
            const navHeight = nav ? nav.offsetHeight : 0;
            const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;

            window.scrollTo({
                top,
                behavior: 'smooth'
            });
        });
    });
}

function setupNavHighlight() {
    const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
    const sections = [...document.querySelectorAll('.content-column > section[id], .profile-column section[id]')];
    const nav = document.querySelector('.top-nav');

    if (!navLinks.length || !sections.length || !nav) {
        return;
    }

    const update = () => {
        let current = 'about';
        let closest = -Infinity;
        const threshold = nav.offsetHeight + 100;
        sections.forEach(section => {
            const top = section.getBoundingClientRect().top;
            if (top <= threshold && top > closest) {
                closest = top;
                current = section.id;
            }
        });
        navLinks.forEach(link => {
            const active = link.hash === `#${current}`;
            link.classList.toggle('active', active);
            if (active) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
}

function loadNews() {
    const homeContainer = document.getElementById('news-container');
    const allContainer = document.getElementById('all-news-container');

    if (!homeContainer && !allContainer) {
        return;
    }

    fetch(getDataPath('news.json'), { cache: 'no-store' })
        .then(handleJsonResponse)
        .then(items => {
            if (homeContainer) {
                setupInlineList(homeContainer, items, renderNewsItems, 3, 'news-toggle');
            }
            if (allContainer) {
                renderNewsItems(items, allContainer);
            }
        })
        .catch(error => {
            console.error('Error loading news data:', error);
        });
}

function loadHonors() {
    const homeContainer = document.getElementById('honors-container');
    const allContainer = document.getElementById('all-honors-container');

    if (!homeContainer && !allContainer) {
        return;
    }

    fetch(getDataPath('honors.json'), { cache: 'no-store' })
        .then(handleJsonResponse)
        .then(items => {
            if (homeContainer) {
                setupInlineList(homeContainer, items, renderHonorsItems, 3, 'honors-toggle');
            }
            if (allContainer) {
                renderHonorsItems(items, allContainer);
            }
        })
        .catch(error => {
            console.error('Error loading honors data:', error);
        });
}

function setupInlineList(container, items, render, limit, buttonId) {
    const button = document.getElementById(buttonId);
    let expanded = false;
    const update = () => {
        render(expanded ? items : items.slice(0, limit), container);
        if (button) {
            button.hidden = items.length <= limit;
            button.textContent = expanded ? uiText('Show Less ↑', '收起 ↑') : uiText('View All ↓', '展开全部 ↓');
            button.setAttribute('aria-expanded', String(expanded));
        }
    };
    if (button) button.addEventListener('click', () => { expanded = !expanded; update(); });
    update();
}

function loadPublications() {
    const featuredContainer = document.getElementById('featured-publications-container');
    const allContainer = document.getElementById('all-publications-container');
    const detailContainer = document.getElementById('paper-detail');

    if (!featuredContainer && !allContainer && !detailContainer) {
        return;
    }

    fetch(getDataPath('publications.json'), { cache: 'no-store' })
        .then(handleJsonResponse)
        .then(publications => {
            if (featuredContainer) {
                const featured = publications
                    .filter(pub => pub.showOnHomepage)
                    .sort(compareFeaturedPublications);
                renderFeaturedPublications(featuredContainer, featured);
            }

            if (allContainer) {
                renderAllPublicationsPage(allContainer, publications);
            }
            if (detailContainer) {
                const id = new URLSearchParams(window.location.search).get('id');
                renderPublicationDetail(detailContainer, publications.find(pub => pub.id === id));
            }
        })
        .catch(error => {
            console.error('Error loading publications data:', error);
            const container = featuredContainer || allContainer || detailContainer;
            if (container) container.textContent = uiText('Failed to load publications.', '论文加载失败。');
        });
}

function renderPublicationDetail(container, pub) {
    container.replaceChildren();
    if (!pub) {
        const message = document.createElement('p');
        message.textContent = uiText('Publication not found. Please return to the publication list.', '未找到这篇论文，请返回论文列表。');
        container.appendChild(message);
        return;
    }
    document.title = `${pub.title} | ${uiText('Xinhua Chen', '陈欣骅')}`;
    const category = document.createElement('p');
    category.className = 'paper-category';
    category.textContent = isChinese ? pub.categoryZh || pub.category : pub.category;
    container.appendChild(category);
    const title = document.createElement('h1');
    const titleText = document.createElement('span');
    titleText.textContent = pub.title;
    title.appendChild(titleText);
    container.appendChild(title);
    if (isChinese && pub.titleZh) {
        const translation = document.createElement('p');
        translation.className = 'pub-title-translation paper-title-translation';
        translation.textContent = pub.titleZh;
        container.appendChild(translation);
    }

    const card = createPublicationItem(pub, { detail: true });
    const titleBadges = card.querySelector('.pub-title-badges');
    if (titleBadges) title.prepend(titleBadges);
    ['.pub-line-2', '.pub-line-3', '.pub-line-4'].forEach(selector => {
        const node = card.querySelector(selector);
        if (node) container.appendChild(node);
    });
    const legend = document.createElement('p');
    legend.className = 'paper-author-legend';
    legend.textContent = uiText('† Equal contribution / co-first author · * Corresponding author.', '† 共同第一作者 · * 通讯作者');
    container.appendChild(legend);
    const figure = card.querySelector('.pub-thumbnail-box a');
    if (figure) {
        figure.className = 'paper-detail-figure';
        container.appendChild(figure);
    }
    const addSection = (heading, text) => {
        if (!text) return;
        const section = document.createElement('section');
        const h2 = document.createElement('h2');
        h2.textContent = heading;
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        section.append(h2, paragraph);
        container.appendChild(section);
    };
    (pub.sections || []).forEach(section => addSection(isChinese ? section.headingZh || section.heading : section.heading, isChinese ? section.textZh || section.text : section.text));
}

function renderFeaturedPublications(container, publications) {
    container.innerHTML = '';

    if (!publications.length) {
        container.innerHTML = `<p class="text-neutral-600">${uiText('Publications will be added soon.', '论文即将更新。')}</p>`;
        return;
    }

    renderAllPublications(container, publications, 2);
}

function renderAllPublicationsPage(container, publications) {
    const filter = getPublicationFilter();
    const filterIndicator = document.getElementById('filter-indicator');

    let filtered = publications.slice();

    if (filter === 'first-author') {
        filtered = filtered.filter(pub => pub.isFirstAuthor === true);
        if (filterIndicator) {
            filterIndicator.textContent = uiText('(First Author)', '（第一作者）');
        }
    } else if (filter === 'accepted') {
        filtered = filtered.filter(pub => String(pub.type || '').toLowerCase() === 'accepted');
        if (filterIndicator) {
            filterIndicator.textContent = uiText('(Accepted)', '（已录用）');
        }
    } else if (filterIndicator) {
        filterIndicator.textContent = '';
    }

    updateFilterButtons(filter);
    renderAllPublications(container, filtered);
}

function renderAllPublications(container, publications, limit = Infinity) {
    container.innerHTML = '';

    if (!publications.length) {
        container.innerHTML = `<p class="empty-state">${uiText('No publications found for this filter.', '没有符合条件的论文。')}</p>`;
        return;
    }

    const grouped = new Map([
        ['AI Algorithms & Systems', []],
        ['Computer Architecture & Hardware Design', []],
        ['Electronic Design Automation', []]
    ]);

    publications
        .slice()
        .sort(compareAllPublications)
        .forEach(pub => {
            const yearLabel = pub.category || 'Other Publications';
            if (!grouped.has(yearLabel)) {
                grouped.set(yearLabel, []);
            }
            grouped.get(yearLabel).push(pub);
        });

    Array.from(grouped.entries()).forEach(([year, items]) => {
        if (!items.length) return;
        const group = document.createElement('div');
        group.className = 'pub-year-group';

        const header = document.createElement('h3');
        header.className = 'pub-year-header';
        header.textContent = isChinese ? (items[0].categoryZh || year) : year;
        group.appendChild(header);


        const list = document.createElement('ul');
        list.className = 'pub-list-ul';
        items.forEach((pub, index) => {
            const item = createPublicationItem(pub);
            item.hidden = index >= limit;
            list.appendChild(item);
        });

        group.appendChild(list);
        if (items.length > limit) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'inline-toggle';
            list.id = `publication-group-${container.id}-${grouped.size}-${container.children.length}`;
            button.setAttribute('aria-controls', list.id);
            button.setAttribute('aria-expanded', 'false');
            button.textContent = uiText('View All ↓', '展开全部 ↓');
            button.addEventListener('click', () => {
                const expanded = button.getAttribute('aria-expanded') !== 'true';
                Array.from(list.children).forEach((item, index) => { item.hidden = !expanded && index >= limit; });
                button.setAttribute('aria-expanded', String(expanded));
                button.textContent = expanded ? uiText('Show Less ↑', '收起 ↑') : uiText('View All ↓', '展开全部 ↓');
            });
            group.appendChild(button);
        }
        container.appendChild(group);
    });
}

function createPublicationItem(pub, { detail = false } = {}) {
    const item = document.createElement('li');
    item.className = 'pub-list-item with-thumbnail-expanded';

    const content = document.createElement('div');
    content.className = 'pub-content-wrapper';

    const line1 = document.createElement('div');
    line1.className = 'pub-line-1';

    const title = document.createElement(!detail && pub.id ? 'a' : 'span');
    title.className = 'pub-title-text';
    title.textContent = pub.displayTitle || pub.title || uiText('Untitled Publication', '未命名论文');
    if (!detail && pub.id) {
        title.href = normalizeAssetPath(`pages/${isChinese ? 'paper-zh.html' : 'paper.html'}?id=${encodeURIComponent(pub.id)}`);
        title.target = '_blank';
        title.rel = 'noopener noreferrer';
        title.title = uiText('View publication details', '查看论文详情');
    }
    line1.appendChild(title);
    content.appendChild(line1);
    if (isChinese && pub.titleZh && !detail) {
        const translation = document.createElement('div');
        translation.className = 'pub-title-translation';
        translation.textContent = pub.titleZh;
        content.appendChild(translation);
    }

    const line2 = document.createElement('div');
    line2.className = 'pub-line-2';
    if (Array.isArray(pub.authors)) {
        pub.authors.forEach((author, index) => {
            if (index) line2.appendChild(document.createTextNode(', '));
            const name = document.createElement(author.isSelf ? 'strong' : 'span');
            name.textContent = author.name;
            line2.appendChild(name);
            const roles = [];
            if (author.equalContribution) roles.push(['†', uiText('Equal contribution / co-first author', '共同第一作者')]);
            if (author.corresponding) roles.push(['*', uiText('Corresponding author', '通讯作者')]);
            roles.forEach(([symbol, role]) => {
                const marker = document.createElement('sup');
                marker.className = 'author-marker';
                marker.textContent = symbol;
                marker.title = role;
                marker.setAttribute('aria-label', role);
                line2.appendChild(marker);
            });
        });
    } else {
        line2.innerHTML = pub.authors || '';
    }
    content.appendChild(line2);

    const line3 = document.createElement('div');
    line3.className = 'pub-line-3';

    const venueFullName = getVenueFullName(pub.venue, pub.year);
    const venueShortName = getVenueShortName(pub.venue, pub.year);
    const venueText = venueFullName || pub.venue || 'Preprint';

    const venueNameSpan = document.createElement('span');
    venueNameSpan.textContent = venueText;
    line3.appendChild(venueNameSpan);

    const titleBadges = document.createElement('span');
    titleBadges.className = 'pub-title-badges';

    if (shouldShowVenueTag(pub.venue, venueFullName, venueShortName)) {
        const venueTag = document.createElement('span');
        venueTag.className = 'pub-venue-tag pub-venue-inline-tag';
        venueTag.textContent = venueShortName;
        venueTag.title = venueFullName || pub.venue;

        const lowerVenue = venueShortName.toLowerCase();
        if (lowerVenue.includes('under review') || lowerVenue.includes('preprint') || lowerVenue.includes('arxiv')) {
            venueTag.classList.add('tag-under-review');
        } else {
            venueTag.classList.add('tag-conference');
        }

        titleBadges.appendChild(venueTag);
    }

    const badgeText = getHighlightBadge(pub.highlight);
    if (badgeText) {
        const badge = document.createElement('span');
        badge.className = 'pub-badge-highlight';
        badge.textContent = badgeText;
        titleBadges.appendChild(badge);
    }

    if (titleBadges.children.length) line1.prepend(titleBadges);
    if (detail) content.appendChild(line3);

    if (pub.tags && Array.isArray(pub.tags)) {
        const line4 = document.createElement('div');
        line4.className = 'pub-line-4';

        pub.tags.forEach(tag => {
            const label = isChinese ? ({Paper:'论文', PDF:'PDF', Code:'代码', Video:'视频', Media:'报道'}[tag.text] || tag.text || '链接') : (detail && tag.text === 'Paper' ? 'Official Paper' : (tag.text || 'Link'));
            const usableLink = hasUsableLink(tag.link);

            const button = document.createElement(usableLink ? 'a' : 'span');
            button.className = 'pub-link-btn';
            button.textContent = label;

            if (usableLink) {
                button.href = normalizeAssetPath(tag.link);
                button.target = '_blank';
                button.rel = 'noopener noreferrer';
            } else {
                button.classList.add('is-placeholder');
                button.title = 'Replace "#" with a real link in data/publications.json';
            }

            line4.appendChild(button);
        });

        if (line4.children.length > 0) {
            content.appendChild(line4);
        }
    }

    item.appendChild(content);

    if (pub.thumbnail) {
        const thumbBox = document.createElement('div');
        thumbBox.className = 'pub-thumbnail-box';

        const thumbImg = document.createElement('img');
        const preferredThumbnail = pub.demo ? getPreferredThumbnail(pub.thumbnail) : {
            primary: normalizeAssetPath(pub.thumbnail),
            fallback: normalizeAssetPath(pub.thumbnail)
        };
        thumbImg.src = preferredThumbnail.primary;
        thumbImg.alt = `${pub.title || uiText('Publication', '论文')} ${uiText('preview', '主图')}`;
        thumbImg.loading = 'lazy';
        thumbImg.onerror = function() {
            if (this.src !== preferredThumbnail.fallback) {
                this.onerror = null;
                this.src = preferredThumbnail.fallback;
            }
        };

        const previewLink = document.createElement('a');
        previewLink.href = normalizeAssetPath(pub.thumbnail);
        previewLink.target = '_blank';
        previewLink.rel = 'noopener noreferrer';
        previewLink.title = uiText('View full-size figure', '查看原图');
        previewLink.appendChild(thumbImg);
        thumbBox.appendChild(previewLink);
        item.appendChild(thumbBox);
    }

    return item;
}

// News icons are keyed by category so additions and reordering keep them consistent.
const NEWS_CATEGORIES = Object.freeze({
    review: { color: '#766394', background: '#f2eef8', path: '<path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m8 13 3 3 5-6"/>' },
    education: { color: '#287e84', background: '#eaf5f5', path: '<path d="m2 9 10-5 10 5-10 5-10-5Z"/><path d="M6 11v6c4 3 8 3 12 0v-6M22 9v7"/>' },
    honor: { color: '#a27a35', background: '#faf4e9', path: '<circle cx="12" cy="9" r="6"/><path d="m8 14-1 8 5-3 5 3-1-8"/><path d="m10 9 1.5 1.5L14 8"/>' },
    internship: { color: '#4d7499', background: '#edf3f9', path: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M12 11v3"/>' },
    publication: { color: '#537a61', background: '#edf5ef', path: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6m-12 6 3 3 5-6"/>' },
    update: { color: '#64748b', background: '#f1f5f9', path: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/>' }
});

function renderNewsItems(newsData, container) {
    container.innerHTML = '';
    if (!newsData.length) {
        container.innerHTML = `<p class="text-neutral-600">${uiText('No updates yet.', '暂无动态。')}</p>`;
        return;
    }

    newsData.forEach(newsItem => {
        const newsElement = document.createElement('div');
        newsElement.className = 'news-item';
        newsElement.dataset.category = newsItem.category || 'update';

        const dateElement = document.createElement('span');
        dateElement.className = 'news-date';
        dateElement.textContent = isChinese ? newsItem.dateZh || newsItem.date || '' : newsItem.date || '';

        const contentElement = document.createElement('div');
        contentElement.className = 'news-content';

        const textSpan = document.createElement('span');
        textSpan.innerHTML = isChinese ? newsItem.contentZh || newsItem.content || '' : newsItem.content || '';
        contentElement.appendChild(textSpan);

        if (Array.isArray(newsItem.links)) {
            newsItem.links.forEach(link => {
                const space = document.createTextNode(' ');
                contentElement.appendChild(space);

                const anchor = document.createElement('a');
                anchor.href = normalizeAssetPath(link.url || '#');
                anchor.textContent = (isChinese && link.textZh) || link.text || uiText('Link', '链接');
                if (shouldOpenInNewTab(anchor.getAttribute('href'))) {
                    anchor.target = '_blank';
                    anchor.rel = 'noopener noreferrer';
                }
                contentElement.appendChild(anchor);
            });
        }

        const category = NEWS_CATEGORIES[newsItem.category] || NEWS_CATEGORIES.update;
        const trackElement = document.createElement('span');
        trackElement.className = 'news-track';
        const iconElement = document.createElement('span');
        iconElement.className = 'news-icon';
        iconElement.setAttribute('aria-hidden', 'true');
        iconElement.style.setProperty('--news-color', category.color);
        iconElement.style.setProperty('--news-bg', category.background);
        iconElement.innerHTML = `<svg viewBox="0 0 24 24">${category.path}</svg>`;
        trackElement.appendChild(iconElement);

        newsElement.appendChild(dateElement);
        newsElement.appendChild(trackElement);
        newsElement.appendChild(contentElement);
        container.appendChild(newsElement);
    });
}

function renderHonorsItems(honorsData, container) {
    container.innerHTML = '';
    if (!honorsData.length) {
        container.innerHTML = `<p class="text-neutral-600">${uiText('Honors and awards will be added soon.', '荣誉奖项即将更新。')}</p>`;
        return;
    }

    const inSidebar = Boolean(container.closest('.honors-sidebar'));
    honorsData.forEach(honorItem => {
        const honorElement = document.createElement('div');
        honorElement.className = 'honor-item';

        const yearElement = document.createElement('div');
        yearElement.className = 'honor-year';
        yearElement.textContent = honorItem.date || '';

        const iconElement = document.createElement('span');
        iconElement.className = 'honor-icon';
        if (honorItem.logo) {
            const logo = document.createElement('img');
            logo.src = normalizeAssetPath(honorItem.logo);
            logo.alt = isChinese ? honorItem.logoAltZh || honorItem.logoAlt || '' : honorItem.logoAlt || '';
            logo.width = 36;
            logo.height = 36;
            iconElement.appendChild(logo);
        } else {
            iconElement.classList.add('honor-symbol');
            const symbol = document.createElement('i');
            symbol.className = 'fas fa-award';
            symbol.setAttribute('aria-hidden', 'true');
            iconElement.appendChild(symbol);
        }

        const contentElement = document.createElement('div');
        contentElement.className = 'honor-content';

        const titleElement = document.createElement('h3');
        if (honorItem.link) {
            const link = document.createElement('a');
            link.href = honorItem.link;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = isChinese ? honorItem.titleZh || honorItem.title || '' : honorItem.title || '';
            titleElement.appendChild(link);
        } else {
            titleElement.textContent = isChinese ? honorItem.titleZh || honorItem.title || '' : honorItem.title || '';
        }
        contentElement.appendChild(titleElement);

        if (honorItem.description) {
            const descElement = document.createElement('p');
            descElement.innerHTML = isChinese ? honorItem.descriptionZh || honorItem.description : honorItem.description;
            if (inSidebar) {
                const footer = document.createElement('div');
                footer.className = 'honor-footer';
                footer.append(descElement, yearElement);
                contentElement.appendChild(footer);
            } else {
                contentElement.appendChild(descElement);
            }
        } else if (inSidebar) {
            const footer = document.createElement('div');
            footer.className = 'honor-footer';
            footer.append(titleElement, yearElement);
            contentElement.appendChild(footer);
        }

        if (!inSidebar) honorElement.appendChild(yearElement);
        honorElement.appendChild(iconElement);
        honorElement.appendChild(contentElement);
        container.appendChild(honorElement);
    });
}

function compareFeaturedPublications(a, b) {
    const orderA = a.featuredOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.featuredOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
        return orderA - orderB;
    }
    return compareAllPublications(a, b);
}

function compareAllPublications(a, b) {
    const yearA = getComparableYear(a);
    const yearB = getComparableYear(b);
    if (yearA !== yearB) {
        return yearB - yearA;
    }

    const acceptedA = String(a.type || '').toLowerCase() === 'accepted' ? 1 : 0;
    const acceptedB = String(b.type || '').toLowerCase() === 'accepted' ? 1 : 0;
    if (acceptedA !== acceptedB) {
        return acceptedB - acceptedA;
    }

    const orderA = a.featuredOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.featuredOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
        return orderA - orderB;
    }

    return String(a.title || '').localeCompare(String(b.title || ''));
}

function getComparableYear(pub) {
    const parsedYear = parseInt(pub.year, 10);
    if (!Number.isNaN(parsedYear)) {
        return parsedYear;
    }
    return String(pub.type || '').toLowerCase() === 'accepted' ? 0 : 9999;
}

function getYearLabel(pub) {
    const parsedYear = parseInt(pub.year, 10);
    if (!Number.isNaN(parsedYear)) {
        return String(parsedYear);
    }
    return 'Preprints / Under Review';
}

function getPublicationFilter() {
    const params = new URLSearchParams(window.location.search);
    return params.get('filter') || 'all';
}

function updateFilterButtons(filter) {
    document.querySelectorAll('.filter-link').forEach(link => {
        link.classList.remove('active');
    });

    if (filter === 'first-author') {
        const element = document.getElementById('filter-first');
        if (element) {
            element.classList.add('active');
        }
    } else if (filter === 'accepted') {
        const element = document.getElementById('filter-accepted');
        if (element) {
            element.classList.add('active');
        }
    } else {
        const element = document.getElementById('filter-all');
        if (element) {
            element.classList.add('active');
        }
    }
}

function getHighlightBadge(highlightText) {
    const text = String(highlightText || '').toLowerCase();
    if (text.includes('oral')) {
        return 'Oral';
    }
    if (text.includes('spotlight')) {
        return 'Spotlight';
    }
    if (text.includes('highlight')) {
        return 'Highlight';
    }
    return '';
}

function getPreferredThumbnail(thumbnailPath) {
    const lastSlash = thumbnailPath.lastIndexOf('/');
    if (lastSlash === -1) {
        const normalized = normalizeAssetPath(thumbnailPath);
        return { primary: normalized, fallback: normalized };
    }

    const directory = thumbnailPath.substring(0, lastSlash);
    return {
        primary: normalizeAssetPath(`${directory}/demo.gif`),
        fallback: normalizeAssetPath(thumbnailPath)
    };
}

function getVenueShortName(venueStr, year) {
    if (!venueStr) {
        return 'Preprint';
    }

    let revisionSuffix = '';
    if (venueStr.toLowerCase().includes('major revision')) {
        revisionSuffix = ', Major';
    } else if (venueStr.toLowerCase().includes('minor revision')) {
        revisionSuffix = ', Minor';
    }

    let s = venueStr.replace(/\d{4}/g, '').trim();
    let suffix = '';

    const conferences = ['NeurIPS', 'ICML', 'ICLR', 'HPCA', 'ISEDA', 'GLSVLSI', 'DATE', 'CVPR', 'ICCV', 'ECCV', 'ICRA', 'AAAI', 'GLOBECOM', 'INFOCOM', 'MOBICOM'];
    for (const conf of conferences) {
        if (s.includes(conf)) {
            if (year) {
                const yearStr = String(year);
                if (yearStr.length === 4) {
                    suffix = ' ' + yearStr;
                }
            }
            return conf + suffix + revisionSuffix;
        }
    }

    if (s.toLowerCase().includes('arxiv')) {
        return 'ArXiv' + revisionSuffix;
    }

    if (s.includes('TDSC')) return 'IEEE TDSC' + revisionSuffix;
    if (s.includes('TMC')) return 'IEEE TMC' + revisionSuffix;
    if (s.includes('JSAC')) return 'IEEE JSAC' + revisionSuffix;
    if (s.includes('TGCN')) return 'IEEE TGCN' + revisionSuffix;
    if (s.includes('LNET')) return 'IEEE LNET' + revisionSuffix;
    if (s.includes('TNSE')) return 'IEEE TNSE' + revisionSuffix;
    if (s.includes('IOTJ') || s.includes('IoTJ')) return 'IEEE IoTJ' + revisionSuffix;

    return s || 'Preprint';
}

function getVenueFullName(venueStr) {
    if (!venueStr) {
        return '';
    }

    const s = venueStr.replace(/\d{4}/g, '').trim();

    if (s.includes('TDSC')) return 'IEEE Transactions on Dependable and Secure Computing';
    if (s.includes('TMC')) return 'IEEE Transactions on Mobile Computing';
    if (s.includes('JSAC')) return 'IEEE Journal on Selected Areas in Communications';
    if (s.includes('TGCN')) return 'IEEE Transactions on Green Communications and Networking';
    if (s.includes('TNSE')) return 'IEEE Transactions on Network Science and Engineering';
    if (s.includes('IoTJ') || s.includes('IOTJ')) return 'IEEE Internet of Things Journal';
    if (s.includes('LNET') || s.includes('LNet')) return 'IEEE Networking Letters';

    if (s.includes('NeurIPS')) return 'Annual Conference on Neural Information Processing Systems';
    if (s.includes('ICLR')) return 'International Conference on Learning Representations';
    if (s.includes('HPCA')) return 'IEEE International Symposium on High-Performance Computer Architecture';
    if (s.includes('ISEDA')) return 'International Symposium of Electronics Design Automation';
    if (s.includes('GLSVLSI')) return 'Great Lakes Symposium on VLSI';
    if (s.includes('DATE')) return 'Design, Automation and Test in Europe';
    if (s.includes('ICML')) return 'International Conference on Machine Learning';
    if (s.includes('CVPR')) return 'IEEE/CVF Conference on Computer Vision and Pattern Recognition';
    if (s.includes('ICCV')) return 'IEEE/CVF International Conference on Computer Vision';
    if (s.includes('ECCV')) return 'European Conference on Computer Vision';
    if (s.includes('ICRA')) return 'IEEE International Conference on Robotics and Automation';
    if (s.includes('AAAI')) return 'AAAI Conference on Artificial Intelligence';
    if (s.includes('GLOBECOM')) return 'IEEE Global Communications Conference';
    if (s.includes('INFOCOM')) return 'IEEE International Conference on Computer Communications';
    if (s.includes('MOBICOM')) return 'Annual International Conference on Mobile Computing and Networking';

    if (s.toLowerCase().includes('arxiv')) return 'arXiv preprint';

    return s;
}

function shouldShowVenueTag(venueStr, fullVenueName, venueShort) {
    if (!venueShort) {
        return false;
    }

    const shortLower = venueShort.toLowerCase().trim();
    const fullLower = String(fullVenueName || '').toLowerCase().trim();

    if (!fullLower || shortLower === fullLower) {
        return false;
    }

    if (venueStr && venueStr.toLowerCase().includes('under review')) {
        return false;
    }

    return true;
}

function getDataPath(fileName) {
    return window.location.pathname.includes('/pages/') ? `../data/${fileName}` : `data/${fileName}`;
}

function normalizeAssetPath(path) {
    if (!path) {
        return path;
    }

    if (/^(https?:|mailto:|tel:|#)/i.test(path)) {
        return path;
    }

    if (window.location.pathname.includes('/pages/') && !path.startsWith('../')) {
        return `../${path}`;
    }

    return path;
}

function hasUsableLink(path) {
    return Boolean(path) && path !== '#';
}

function handleJsonResponse(response) {
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
}

function makeAllLinksOpenInNewTab() {
    document.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (shouldOpenInNewTab(href)) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
    });
}

function shouldOpenInNewTab(href) {
    if (!href) {
        return false;
    }
    if (href.startsWith('#')) {
        return false;
    }
    if (href.startsWith('../') || href.startsWith('./')) {
        return false;
    }
    if (/^[a-zA-Z]:\\/.test(href)) {
        return false;
    }
    if (href.endsWith('.html')) {
        return false;
    }
    return true;
}

function setupLinkObserver() {
    if (!document.body) {
        return;
    }

    const observer = new MutationObserver(mutations => {
        let shouldRefreshLinks = false;

        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldRefreshLinks = true;
                break;
            }
        }

        if (shouldRefreshLinks) {
            makeAllLinksOpenInNewTab();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}
