package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"
)

const ENV_APPENDIX_LOG = "APPENDIX_LOG"
const ENV_API_TOKEN = "API_TOKEN"
const ENV_APPENDIX_ADDR = "APPENDIX_ADDR"
const EmptyMessageID MessageID = "-"

var newLine = []byte{10}

type Namespace string // dataset.v1
type MessageID string
type MessageOperator string
type Timestamp int64

const MessageOperatorAdd MessageOperator = "ADD"
const MessageOperatorUpdate MessageOperator = "UPD"
const MessageOperatorDelete MessageOperator = "DEL"

type MessageMeta struct {
	Namespace Namespace       `json:"ns"`
	Operation MessageOperator `json:"op"`
	MessageID MessageID       `json:"message_id"`
	Timestamp Timestamp       `json:"ts"`
}

type Message struct {
	ID   MessageID       `json:"id"`
	Meta MessageMeta     `json:"meta"`
	Data json.RawMessage `json:"data"`
}

type Payload struct {
	Cursor   MessageID `json:"cursor"`
	Messages []Message `json:"messages"`
}

func (p *Payload) UnmarshalJSON(data []byte) error {
	required := struct {
		Cursor   *MessageID `json:"cursor"`
		Messages []Message  `json:"messages"`
	}{}
	if err := json.Unmarshal(data, &required); err != nil {
		return err
	} else if required.Cursor == nil {
		return errors.New("missing: cursor")
	} else if required.Messages == nil {
		return errors.New("missing: messages")
	}
	p.Cursor = *required.Cursor
	p.Messages = required.Messages
	return nil
}

func main() {
	fileName := os.Getenv(ENV_APPENDIX_LOG)
	apiToken := os.Getenv(ENV_API_TOKEN)

	f, err := os.OpenFile(fileName, os.O_APPEND|os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		panic(err)
	}
	defer f.Close()

	app := NewApp(f)
	if err := app.loadStorage(); err != nil {
		panic(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/sync", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-NodeID")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			return // Preflight
		}

		if r.Method != http.MethodPost {
			http.Error(w, `{"error": "method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		authorization := r.Header.Get("Authorization")
		idToken := strings.TrimSpace(strings.Replace(authorization, "Bearer", "", 1))
		if apiToken != "" && apiToken != idToken {
			http.Error(w, `{"error": "forbidden"}`, http.StatusForbidden)
			return
		}

		var p Payload
		err := json.NewDecoder(r.Body).Decode(&p)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		response, err := app.processPayload(&p)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	srv := &http.Server{
		Addr:    os.Getenv(ENV_APPENDIX_ADDR),
		Handler: mux,
	}
	if srv.Addr == "" {
		srv.Addr = ":3333"
	}
	go func() {
		if err := srv.ListenAndServe(); err != nil {
			panic(err)
		}
	}()

	<-done

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer func() {
		cancel()
	}()

	if err := srv.Shutdown(ctx); err != nil {
		os.Exit(2)
	}
}

var ErrBadRequest = errors.New(`{"error": "bad request"}`)

type App struct {
	sync.RWMutex
	stream  io.ReadWriter
	storage []Message
	ids     map[MessageID]any
}

func NewApp(log io.ReadWriter) *App {
	return &App{
		stream:  log,
		storage: make([]Message, 0),
		ids:     make(map[MessageID]any),
	}
}

func sortMessages(msgs []Message) {
	sort.SliceStable(msgs, func(i, j int) bool {
		if msgs[i].Meta.Timestamp == msgs[j].Meta.Timestamp {
			return msgs[i].ID < msgs[j].ID
		}
		return msgs[i].Meta.Timestamp < msgs[j].Meta.Timestamp
	})
}

func (a *App) processPayload(p *Payload) (*Payload, error) {
	err := a.saveRequest(p)
	if err != nil {
		return nil, err
	}
	messages, cursor := a.getMessagesAfter(p.Cursor, p.Messages)
	return a.getResponse(p.Cursor, cursor, messages), nil
}

func (a *App) saveRequest(p *Payload) error {
	a.Lock()
	defer a.Unlock()

	added := false
	for i := range p.Messages {
		if _, found := a.ids[p.Messages[i].ID]; found {
			continue
		}
		msg, err := json.Marshal(p.Messages[i])
		if err != nil {
			return ErrBadRequest
		}
		if _, err := a.stream.Write(msg); err != nil {
			return err
		}
		if _, err = a.stream.Write(newLine); err != nil {
			return err
		}
		if syncer, ok := a.stream.(interface{ Sync() error }); ok {
			if err := syncer.Sync(); err != nil {
				return err
			}
		}
		a.storage = append(a.storage, p.Messages[i])
		a.ids[p.Messages[i].ID] = nil
		added = true
	}
	if added {
		sortMessages(a.storage)
	}
	return nil
}

func (a *App) getResponse(messageID MessageID, cursor MessageID, messages []Message) *Payload {
	return &Payload{
		Cursor: func() MessageID {
			if cursor != "" {
				return cursor
			}
			if messageID != "" {
				return messageID
			}
			return EmptyMessageID
		}(),
		Messages: messages,
	}
}

func (a *App) getMessagesAfter(messageID MessageID, incoming []Message) ([]Message, MessageID) {
	a.RLock()
	defer a.RUnlock()

	incomingMap := make(map[MessageID]struct{}, len(incoming))
	for _, m := range incoming {
		incomingMap[m.ID] = struct{}{}
	}

	var res []Message
	if messageID == "" || messageID == EmptyMessageID {
		res = a.storage[:]
	} else {
		foundIdx := -1
		for i := 0; i < len(a.storage); i++ {
			if a.storage[i].ID == messageID {
				foundIdx = i
				break
			}
		}
		if foundIdx != -1 {
			res = a.storage[foundIdx+1:]
		} else {
			res = a.storage[:]
		}
	}

	filtered := make([]Message, 0, len(res))
	for _, m := range res {
		if _, inIncoming := incomingMap[m.ID]; !inIncoming {
			filtered = append(filtered, m)
		}
	}
	var cursor MessageID
	if len(res) > 0 {
		cursor = res[len(res)-1].ID
	}
	return filtered, cursor
}

func (a *App) loadStorage() error {
	d := json.NewDecoder(a.stream)
	for {
		var m Message
		if err := d.Decode(&m); err == io.EOF {
			sortMessages(a.storage)
			return nil
		} else if err != nil {
			return err
		}
		if _, found := a.ids[m.ID]; found {
			continue
		}
		a.ids[m.ID] = nil
		a.storage = append(a.storage, m)
	}
}
