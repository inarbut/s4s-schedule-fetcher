// ==UserScript==
// @name         KSE Schedule Auto-Sync
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Automatically syncs your KSE schedule to the team dashboard
// @author       Your Team
// @match        https://schedule.kse.ua/*
// @updateURL    https://raw.githubusercontent.com/inarbut/s4s-schedule-fetcher/refs/heads/main/script.js
// @downloadURL  https://raw.githubusercontent.com/inarbut/s4s-schedule-fetcher/refs/heads/main/script.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const SERVER_URL = 'https://narbut.app';
    const SYNC_INTERVAL = 5 * 60 * 1000;

    function getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    function getWeekRange(weekOffset) {
        const today = new Date();
        const monday = getMonday(today);
        monday.setDate(monday.getDate() + (weekOffset * 7));

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        return {
            from: formatDate(monday),
            to: formatDate(sunday)
        };
    }

    async function fetchScheduleForWeek(token, weekOffset) {
        const { from, to } = getWeekRange(weekOffset);

        try {
            const response = await fetch(
                `https://api.kse.today/schedule?from=${from}&till=${to}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, text/plain, */*'
                    }
                }
            );

            if (!response.ok) {
                console.error(`Failed to fetch week ${weekOffset}: ${response.status}`);
                return null;
            }

            const data = await response.json();
            let events = [];
            if (data.events && Array.isArray(data.events)) {
                events = data.events.flat().filter(e => e !== null && e !== undefined);
            } else if (Array.isArray(data)) {
                events = data.filter(e => e !== null && e !== undefined);
            }

            return {
                from,
                to,
                events
            };
        } catch (error) {
            console.error(`Error fetching week ${weekOffset}:`, error);
            return null;
        }
    }

    async function syncSchedules() {
        try {
            const authData = localStorage.getItem('__NEXUS_REACT_ADMIN_AUTH__');
            if (!authData) {
                console.log('KSE Schedule Sync: Not logged in');
                return;
            }

            const auth = JSON.parse(authData);
            if (!auth.user.token) {
                console.log('KSE Schedule Sync: No token found');
                return;
            }

            const token = auth.user.token;
            const name = auth.user?.profile?.name || 'Unknown User';
            const email = auth.jwtPayload.email || 'unknown@kse.org.ua';

            console.log(`KSE Schedule Sync: Fetching schedules for ${name}...`);

            const week0 = await fetchScheduleForWeek(token, 0);
            const week1 = await fetchScheduleForWeek(token, 1);
            const week2 = await fetchScheduleForWeek(token, 2);

            if (!week0 && !week1 && !week2) {
                console.error('KSE Schedule Sync: Failed to fetch any schedules');
                return;
            }

            const schedules = {
                week0,
                week1,
                week2
            };

            const response = await fetch(`${SERVER_URL}/api/sync-schedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    email,
                    schedules
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log(`✅ KSE Schedule Sync: Successfully synced schedules for ${name}`);
            } else {
                console.error(`❌ KSE Schedule Sync: Error - ${result.error}`);
            }
        } catch (error) {
            console.error('KSE Schedule Sync: Error during sync', error);
        }
    }

    function init() {
        console.log('KSE Schedule Auto-Sync: Script loaded');

        setTimeout(() => {
            syncSchedules();
        }, 3000);

        setInterval(() => {
            syncSchedules();
        }, SYNC_INTERVAL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
