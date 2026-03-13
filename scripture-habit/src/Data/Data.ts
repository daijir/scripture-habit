import {
    UilEstate,
    UilClipboardAlt,
    UilUsersAlt,
    UilUser,
} from "@iconscout/react-unicons";
import React from 'react';

export interface SidebarItem {
    icon: React.ElementType;
    heading: string;
}

export const SidebarData: SidebarItem[] = [
    {
        icon: UilEstate,
        heading: "Dashboard",
    },
    {
        icon: UilClipboardAlt,
        heading: "My Notes",
    },
    {
        icon: UilUser,
        heading: "Profile",
    },
    {
        icon: UilUsersAlt,
        heading: "My Group",
    },
]

export interface ScriptureOption {
    value: string;
    label: string;
}

export const ScripturesOptions: ScriptureOption[] = [
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
    {
        value: "Ordinances and Proclamations",
        label: "Ordinances and Proclamations"
    },
    {
        value: "General Conference",
        label: "General Conference"
    },
    {
        value: "BYU Speeches",
        label: "BYU Speeches"
    },
    {
        value: "Other",
        label: "Other"
    },
]