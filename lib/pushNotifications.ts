export async function registerPushNotifications(userId: string) {
    if (!("serviceWorker" in navigator)) return;

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
        return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");

    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
    });

    const keys = subscription.toJSON().keys;

    if (!keys?.p256dh || !keys?.auth) {
        return;
    }

    const { supabase } = await import("@/lib/supabase");

    await supabase
        .from("push_subscriptions")
        .upsert({
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            user_agent: navigator.userAgent,
        });

    await supabase
        .from("push_subscriptions")
        .upsert({
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            user_agent: navigator.userAgent,
        });
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);

    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}