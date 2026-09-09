import { Account } from "./account-manager.ts";


class NavItem {
    name: string;
    link: string;

    constructor(name?: string, link?: string) {
        this.name = name || '';
        this.link = link || '';
    }
}

export const buildComponents = async () => {
    const body = document.body;
    body.insertBefore(createHeader(), body.firstChild);
    body.appendChild(createFooter());

    // Create parallax for the background
    document.addEventListener('scroll', () => {
        const html = document.getElementsByTagName('html')[0];
        const parallaxStrength = 0.9;
        html.style.backgroundPositionY = `${(window.scrollY * parallaxStrength).toPrecision()}px`;
    });

    const nav = createNavigation();
    const sectionRight = document.createElement('section');
    
    nav.append(sectionRight);
    body.insertBefore(nav, body.firstChild);

    const { username, alias, email, type } = await (await fetch(
        `${import.meta.env.VITE_API_URL}/api/me`, { credentials: 'include' })).json();    
    const user = new Account(username, alias, email, type);
    
    await renderAccountDetials(sectionRight, user);

    return user;
}

const createLogo = (className: string): HTMLAnchorElement => {
    const logo = document.createElement('img');
    const indexLink = document.createElement('a');
    
    logo.className = 'logo';
    logo.src = 'Resources/Images/LoL.png';
    logo.alt = "A Lemon head";

    indexLink.href = 'index.html';
    indexLink.className = className;
    indexLink.appendChild(logo);
    
    return indexLink;
}

const createHeader = (): HTMLElement => {
    const header = document.createElement('header');
    const title = document.createElement('h1');
    
    title.textContent = 'District 4';
    
    header.className = 'main-header';
    header.append(createLogo('header-logo'), title);

    return header;
}

const createFooter = (): HTMLElement => {
    const footer = document.createElement('footer');
    const motto = document.createElement('p');
    const siteName = document.createElement('small');
    const logo = createLogo('footer-logo');

    siteName.innerText = 'District 4';
    motto.innerText = 'The Intermission is Real';

    footer.className = 'main-footer';
    footer.append(motto, logo, siteName);

    return footer;
}

const createDropdown = (...childNodes: HTMLElement[]) => {
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown';

    dropdown.append(...childNodes);
    return dropdown;
}

// Create on-demand, stored references aren't needed
const getNavSections = () => {
    return {
        middle: [
            { name: 'News',   link: 'news' },
            { name: 'Library', link: 'library' },
            { name: 'Gallery', link: 'gallery' },
            { name: 'Portfolio', link: 'portfolio' }
        ],
        right: []
    };
}

const createNavButton = (item: NavItem) => {
    const button = document.createElement('a');
    button.className = 'navigation-button';
    button.textContent = item.name;
    button.href = `${item.link}.html`;

    return button;
}

const createButtonContainer = (nodes: Node[]) => {
    if (nodes.length === 0) { return null; }

    const container = document.createElement('div');
    container.className = 'main-nav-button-container';
    
    container.append(...nodes);
    return container;
}

const tryAdminNodes = async () => {
    const nodes: HTMLElement[] = [];

    try {
        const dropDownHTML = await (await fetch(
            `${import.meta.env.VITE_API_URL}/api/get_admin_nav`, { credentials: 'include' })
        ).text();

        if (dropDownHTML) {
            document.body.insertAdjacentHTML('beforeend', dropDownHTML);

            const prepareAdminButton = async (id: string, url: string) => {
                const button = document.getElementById(id) as HTMLAnchorElement;

                if (button) { button.href = url; }
                
                return button;
            }

            const adminNodes = await Promise.all([
                prepareAdminButton('admin-panel-button', './admin_panel.html'),
                prepareAdminButton('admin-portal-button', './upload.html')
            ]);

            nodes.push(
                createNavButton({ name: 'Admin', link: 'admin_panel' }), 
                createDropdown(...adminNodes.filter(b => !(!b)))
            );
        }
    } catch (e) {
        console.error('No good:', e);
    }

    return nodes;
}

const generateNavButtons = (items: NavItem[]) => items.map(i => createNavButton(i));

const createNavigation = () => {
    const websiteTitle = document.createElement('a');
    websiteTitle.className = 'website-title'
    websiteTitle.textContent = 'District 4';
    websiteTitle.href = '../index.html';

    // Prepare sections
    const sectionLeft = document.createElement('section');
    const sectionMid = document.createElement('section');
    const { middle } = getNavSections();

    const viewPortfolio = new URLSearchParams(window.location.search).get('showPortfolio');
    if (viewPortfolio !== 'true') { middle.pop(); } // Removes the Portfolio button

    // Append default buttons
    sectionLeft.append(websiteTitle);
    sectionMid.append(...generateNavButtons(middle));

    const navigation = document.createElement('div');
    navigation.className = 'navigation';
    navigation.append(sectionLeft, sectionMid);

    return navigation;
}

const renderAccountDetials = async (section: HTMLElement, user: Account) => {
     const createAccountDropdown = () => {
        const username = document.createElement('span');
        username.textContent = `Welcome, ${user.alias}!`;
        username.style.textAlign = 'center';

        const icon = document.createElement('img');
        icon.style.maxWidth = '120px';
        icon.style.height = '120px';
        icon.style.margin = 'auto';
        icon.src = './Resources/Images/perhaps.png';

        const accountInfo = document.createElement('div');
        accountInfo.style.display = 'flex';
        accountInfo.style.flexDirection = 'column';
        accountInfo.append(username, icon);

        // TODO : Add accountSettings to dropdown once settings page is implemented
        const accountSettings = document.createElement('a');
        accountSettings.textContent = 'Settings';

        const logout = document.createElement('a');
        logout.textContent = 'Log Out';
        logout.addEventListener('click', async () => { 
            const result = await fetch(`${import.meta.env.VITE_API_URL}/api/login`, { 
                method: 'DELETE', credentials: 'include' });
           
            if (!result.ok) { 
                console.error('Logout failed:', await result.json());
                return;
            }

            sessionStorage.removeItem('user');
            window.location.href = 'index.html';
        });

        return createDropdown(accountInfo, /* accountSettings, */ logout);
    }

    const { name, link } = user.isEmpty() ? { name: 'Log In', link: 'login' } : { name: user.alias, link: '#' };
    const accountNodes: HTMLElement[] = [createNavButton(new NavItem(name, link))];

    if (!user.isEmpty()) {
        accountNodes.push(createAccountDropdown());
    }
    
    const rightGroups = {
        accountNodes: accountNodes,
        adminNodes: [ ...(await tryAdminNodes()) ]
    };
    const rightContainers = [ createButtonContainer(rightGroups.accountNodes) ];

    if (rightGroups.adminNodes.length > 0) {
        const adminContainer = createButtonContainer(rightGroups.adminNodes);
        if (adminContainer) { rightContainers.push(adminContainer); }
    }

    section.append(...rightContainers.filter(n => !(!n)));
}
