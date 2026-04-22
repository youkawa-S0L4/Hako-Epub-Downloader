// ==UserScript==
// @name         Hako_epub
// @version      1.0
// @description  Hỗ trợ đa tên miền Hako
// @match        https://docln.net/truyen/*
// @match        https://ln.hako.vn/truyen/*
// @match        https://docln.sbs/truyen/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- GIỮ NGUYÊN LOGIC CŨ ---
    let jszipScript = document.createElement('script');
    jszipScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(jszipScript);

    const wakeLockAudio = new Audio('https://raw.githubusercontent.com/anars/blank-audio/master/10-seconds-of-silence.mp3');
    wakeLockAudio.loop = true;

    // --- CẢI TIẾN GIAO DIỆN MINI-PANEL ---
    let container = document.createElement("div");
    container.id = "hako-container";
    container.style = "position:fixed;top:70px;left:5px;z-index:10001;font-family:monospace;";
    document.body.appendChild(container);

    // Nút thu gọn (Mini Circle)
    let miniBtn = document.createElement("div");
    miniBtn.innerHTML = "📦";
    miniBtn.style = "width:40px;height:40px;background:#1a1a1a;border:2px solid #00ff00;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 10px #00ff00;display:none;";
    
    // Bảng điều khiển chính
    let panel = document.createElement("div");
    panel.style = "background:#1a1a1a;padding:15px;border:2px solid #00ff00;border-radius:12px;color:#00ff00;width:240px;box-shadow:0 0 20px #00ff0044;transition: 0.3s;";
    panel.innerHTML = `
        <div id="panel-header" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <b style="font-size:14px;color:#fff;">HAKO_EPUB <span style="color:#00ff00;">v9.5</span></b>
            <span id="btn-minimize" style="color:#00ff00;font-size:18px;">−</span>
        </div>
        <div id="panel-content">
            <div style="background:#333;height:10px;margin:12px 0;border-radius:5px;overflow:hidden;">
                <div id="bar" style="width:0%;height:100%;background:#00ff00;transition:0.3s;"></div>
            </div>
            <div id="prog" style="color:#fff;font-size:11px;margin-bottom:5px;">Trạng thái: Chờ lệnh...</div>
            <button id="btn-start" style="background:#00ff00;color:#000;width:100%;border:none;padding:10px;font-weight:bold;border-radius:6px;cursor:pointer;">BẮT ĐẦU CÀO</button>
            <button id="btn-resume" style="display:none;background:#444;color:#fff;width:100%;border:none;padding:8px;font-size:11px;border-radius:6px;margin-top:5px;cursor:pointer;">TIẾP TỤC</button>
        </div>
    `;
    
    container.appendChild(miniBtn);
    container.appendChild(panel);

    // Xử lý ẩn/hiện (Minimize/Maximize)
    const togglePanel = () => {
        if (panel.style.display === "none") {
            panel.style.display = "block";
            miniBtn.style.display = "none";
        } else {
            panel.style.display = "none";
            miniBtn.style.display = "flex";
        }
    };
    document.getElementById("panel-header").onclick = togglePanel;
    miniBtn.onclick = togglePanel;

    // --- TIẾP TỤC GIỮ NGUYÊN LOGIC CŨ ---
    if (GM_getValue("saved_index") !== undefined) document.getElementById("btn-resume").style.display = "block";

    async function downloadOriginal(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET", url: url, responseType: "arraybuffer",
                headers: { "Referer": window.location.origin + "/" },
                timeout: 20000,
                onload: (res) => resolve(res.status === 200 ? res.response : null),
                onerror: () => resolve(null),
                ontimeout: () => resolve(null)
            });
        });
    }

    document.getElementById("btn-start").onclick = () => run(false);
    document.getElementById("btn-resume").onclick = () => run(true);

    async function run(isResume) {
        if (typeof JSZip === 'undefined') {
            alert('Thư viện nén chưa tải xong!');
            return;
        }
        let links = Array.from(document.querySelectorAll(".chương-link a, .chapter-name a")).map(a => a.href);
        let startIdx = isResume ? GM_getValue("saved_index", 0) : 0;
        document.getElementById("btn-start").disabled = true;
        document.getElementById("btn-start").innerText = "ĐANG CHẠY...";
        wakeLockAudio.play();

        let zip = new JSZip();
        let title = document.querySelector(".series-name").innerText;
        let auth = document.querySelector(".series-author a")?.innerText || "Unknown";
        zip.file("mimetype", "application/epub+zip");
        let oebps = zip.folder("OEBPS");
        let imgFolder = oebps.folder("Images");
        let htmlFolder = oebps.folder("Text");
        let manifest = ""; let spine = ""; let toc = ""; let imgId = 0;

        let frame = document.createElement("iframe");
        frame.style.display = "none";
        document.body.appendChild(frame);

        for (let i = startIdx; i < links.length; i++) {
            let percent = ((i + 1) / links.length * 100);
            document.getElementById("bar").style.width = percent + "%";
            document.getElementById("prog").innerText = `Đang xử lý: ${i+1}/${links.length}`;

            const chapter = await new Promise((resolve) => {
                let timer = setTimeout(() => { resolve(null); }, 30000);
                frame.src = links[i];
                frame.onload = function() {
                    setTimeout(async () => {
                        clearTimeout(timer);
                        try {
                            let d = frame.contentDocument || frame.contentWindow.document;
                            let t = d.querySelector(".title-top")?.innerText || "Chương " + (i+1);
                            let body = d.getElementById("chapter-content");
                            let imgs = body.querySelectorAll("img");
                            for (let im of imgs) {
                                let s = im.getAttribute("data-src") || im.src;
                                if (s && !s.includes("data:image")) {
                                    imgId++;
                                    let data = await downloadOriginal(s);
                                    if (data) {
                                        imgFolder.file(`i${imgId}.jpg`, data);
                                        manifest += `<item id="img${imgId}" href="Images/i${imgId}.jpg" media-type="image/jpeg"/>`;
                                        im.src = `../Images/i${imgId}.jpg`;
                                    }
                                }
                            }
                            resolve({ t, b: body.innerHTML });
                        } catch (e) { resolve(null); }
                    }, 1500);
                };
            });

            if (chapter) {
                let fname = `ch${i+1}.xhtml`;
                htmlFolder.file(fname, `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${chapter.t}</title><style>img{max-width:100%}</style></head><body><h2>${chapter.t}</h2>${chapter.b}</body></html>`);
                manifest += `<item id="c${i+1}" href="Text/${fname}" media-type="application/xhtml+xml"/>`;
                spine += `<itemref idref="c${i+1}"/>`;
                toc += `<navPoint id="n${i+1}"><navLabel><text>${chapter.t}</text></navLabel><content src="Text/${fname}"/></navPoint>`;
            }
            GM_setValue("saved_index", i + 1);
        }

        oebps.file("content.opf", `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>${auth}</dc:creator></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>${manifest}</manifest><spine toc="ncx">${spine}</spine></package>`);
        oebps.file("toc.ncx", `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap>${toc}</navMap></ncx>`);
        zip.folder("META-INF").file("container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);

        zip.generateAsync({type:"blob"}).then(b => {
            let a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = title.replace(/\s+/g, '_') + ".epub";
            a.click();
            GM_deleteValue("saved_index");
            alert("Đã tải xong!");
            location.reload();
        });
    }
})();
        
