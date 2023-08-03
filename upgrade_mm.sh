#!/bin/bash
### Erforderliche Parameter
installation_package_path=$1
sha256_checksum=$2

### Optionale Parameter
mattermost_install_path=${3:-/opt/mattermost}

### Überprüfung ob Installationspfad vorhanden
if ! [ -d "$mattermost_install_path" ]; then
    echo "[ERROR]Das Installationsverzeichnis existiert nicht. Bitte Pfad überprüfen."
    exit 1
else
    echo "[SUCCESS] Installationsverzeichnis $mattermost_install_path existiert"
fi

### Überprüfung ob Installationspaket vorhanden
if ! [ -f "$installation_package_path" ]; then
    echo "[ERROR] Das angegebene Installationspaket existiert nicht. Bitte Pfad überprüfen."
    exit 1
else
    echo "[SUCCESS] Installationspaket $installation_package_path vorhanden"
fi

### SHA-256 Checksumme gegenprüfen
if ! sha256sum -c <(echo "$sha256_checksum") < "$installation_package_path"; then
    echo "[ERROR] Die Prüfsumme stimmt nicht überein. Bitte stellen Sie sicher, dass Sie das richtige Installationspaket heruntergeladen haben."
    exit 1
else
    echo "[SUCCESS] Prüfsumme $sha256_checksum stimmt überein
fi

### Updatedatei entpacken
tar -xf "$installation_package_path" -c "/tmp" --transform='s,^[^/]+,\0-upgrade,'

### Überprüfen auf Fehler beim Entpacken
if [ $? -ne 0 ]; then
    echo "[ERROR] Fehler beim Entpacken des Installationspakets. Ist genug Speicherplatz unter /opt/mattermost vorhanden?"
    exit 1
else 
    echo "[SUCCESS] Installationspaket erfolgreich nach /tmp/mattermost-upgrade extrahiert."
fi

### MM stoppen
sudo systemctl stop mattermost

### Löschen der alten Mattermost-Installation
sudo find "$mattermost_install_path" -mindepth 1 -maxdepth 1 ! ( -type d ( -path "$mattermost_install_path"/client -o -path "$mattermost_install_path"/client/plugins -o -path "$mattermost_install_path"/config -o -path "$mattermost_install_path"/logs -o -path "$mattermost_install_path"/plugins -o -path "$mattermost_install_path"/data ) -prune ) | sort | sudo xargs rm -r

### Kopieren der neuen Mattermost-Installation / Ändern der Eigentümerschaft und Berechtigungen
sudo cp -an /tmp/mattermost-upgrade/. "$mattermost_install_path"
sudo chown -R mattermost:mattermost "$mattermost_install_path"

### MM starten
sudo systemctl start mattermost

if ! systemctl is-active mattermost.service; then
    echo "[ERROR] Der Mattermost-Dienst konnte nicht gestartet werden."
    exit 1
else
    echo "[SUCCESS] Der Mattermost-Dienst wurde erfolgreich gestartet. Upgrade beendet."
fi

### Clean-Up
sudo rm -r /tmp/mattermost-upgrade
sudo rm "$installation_package_path"
