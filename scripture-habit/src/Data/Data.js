import {
    UilEstate,
    UilClipboardAlt,
    UilUsersAlt,
    UilGlobe,
} from "@iconscout/react-unicons";

import scripture1 from '../assets/images/scrip1.jpg'
import scripture2 from '../assets/images/scrip2.jpg'
import scripture3 from '../assets/images/scrip3.jpg'

export const SidebarData = [
    {
        icon: UilEstate,
        heading: "Dashboard",
    },
    {
        icon: UilClipboardAlt,
        heading: "My Notes",
    },
    {
        icon: UilGlobe,
        heading: "Languages",
    },
    {
        icon: UilUsersAlt,
        heading: "My Group",
    },
]

export const ScripturesGallery = [
    {
        src: scripture1, title: 'My Study 1', description: 'Greice Study'
    },
    {
        src: scripture2, title: 'My Study 2', description: 'Greice Study'
    },
    {
        src: scripture3, title: 'My Study 3', description: 'Greice Study'
    },
]

export const ScripturesOptions = [
    {
        value: "Old Testament",
        label: "Old Testament"
    },
    {
        value: "New Testament",
        label: "New Testament"
    },
    {
        value: "Book of Mormon",
        label: "Book of Mormon"
    }, {
        value: "Doctrine and Covenants",
        label: "Doctrine and Covenants"
    },
    {
        value: "Pearl of Great Price",
        label: "Pearl of Great Price"
    },
]